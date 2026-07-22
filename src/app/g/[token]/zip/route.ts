/*
  Whole gallery download as one zip. This replaces the old download-all loop
  that clicked one anchor per photo, which fought mobile browsers (permission
  prompts, files landing outside Photos, the tab pinned open for minutes).

  The zip is store-only (no compression): the photos are already compressed
  JPEG/HEIC, so store costs nothing in size, needs no dependency, and streams.
  Each photo is pulled from storage one at a time and streamed straight out,
  so memory stays bounded at one photo regardless of gallery size. CRCs are
  computed while streaming and emitted in data descriptors, the standard zip
  streaming shape every unzipper understands.

  The story card PNG rides along as the last entry, the same way the phone
  share flow saves it next to the photos. A failed card render is not fatal:
  the photos are the point, so the zip ships without it.

  Public, keyed by the recipient token like the per photo route. Writes the
  downloaded event once (the review ask trigger) unless preview=1.
*/
import { after } from "next/server";
import { getGalleryByToken, isExpired } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderGuestCard } from "@/lib/guest-card-render";
import { sendReviewAskAfterDownload } from "@/lib/review-ask";
import { CANONICAL_ORIGIN } from "@/lib/base-url";

export const maxDuration = 120;

// Classic zip caps: stay under 4GB total and 65535 entries or the 32 bit
// fields overflow. Photo count is already capped at 200 per send; the size
// guard is here for safety.
const MAX_ZIP_BYTES = 3.5 * 1024 * 1024 * 1024;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32Update(state: number, buf: Uint8Array): number {
  let c = state;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return c >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function localHeader(name: Uint8Array, time: number, date: number): Uint8Array {
  const b = new Uint8Array(30 + name.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true); // version needed
  v.setUint16(6, 0x0808, true); // data descriptor + UTF-8 names
  v.setUint16(8, 0, true); // store
  v.setUint16(10, time, true);
  v.setUint16(12, date, true);
  // crc and sizes are zero here and arrive in the data descriptor
  v.setUint16(26, name.length, true);
  b.set(name, 30);
  return b;
}

function dataDescriptor(crc: number, size: number): Uint8Array {
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x08074b50, true);
  v.setUint32(4, crc, true);
  v.setUint32(8, size, true);
  v.setUint32(12, size, true);
  return b;
}

function centralHeader(
  name: Uint8Array,
  time: number,
  date: number,
  crc: number,
  size: number,
  localOffset: number,
): Uint8Array {
  const b = new Uint8Array(46 + name.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true); // made by
  v.setUint16(6, 20, true); // version needed
  v.setUint16(8, 0x0808, true);
  v.setUint16(10, 0, true); // store
  v.setUint16(12, time, true);
  v.setUint16(14, date, true);
  v.setUint32(16, crc, true);
  v.setUint32(20, size, true);
  v.setUint32(24, size, true);
  v.setUint16(28, name.length, true);
  v.setUint32(42, localOffset, true);
  b.set(name, 46);
  return b;
}

function endOfCentral(count: number, cdSize: number, cdOffset: number): Uint8Array {
  const b = new Uint8Array(22);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, cdSize, true);
  v.setUint32(16, cdOffset, true);
  return b;
}

// Zip entry names must be unique and path free, or extractors overwrite files
// or refuse the archive.
function entryNames(photos: { filename: string | null }[]): string[] {
  const used = new Map<string, number>();
  return photos.map((p, i) => {
    let name = (p.filename ?? "").replace(/[\\/]/g, "_").trim() || `photo-${i + 1}.jpg`;
    const n = used.get(name) ?? 0;
    used.set(name, n + 1);
    if (n > 0) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)} (${n + 1})${name.slice(dot)}` : `${name} (${n + 1})`;
    }
    return name;
  });
}

async function* zipParts(
  admin: ReturnType<typeof createAdminClient>,
  photos: { storage_key: string; name: string }[],
  card: { name: string; render: () => Promise<Uint8Array | null> } | null,
): AsyncGenerator<Uint8Array> {
  const enc = new TextEncoder();
  const { time, date } = dosTime(new Date());
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const p of photos) {
    const nameBytes = enc.encode(p.name);
    const local = localHeader(nameBytes, time, date);
    const localOffset = offset;
    yield local;
    offset += local.length;

    const { data: blob, error } = await admin.storage.from("photos").download(p.storage_key);
    if (error || !blob) {
      throw new Error(`zip: download failed for ${p.storage_key}: ${error?.message ?? "no data"}`);
    }
    let crc = 0xffffffff;
    let size = 0;
    const reader = blob.stream().getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      crc = crc32Update(crc, value);
      size += value.length;
      offset += value.length;
      yield value;
    }
    const finalCrc = (crc ^ 0xffffffff) >>> 0;
    const desc = dataDescriptor(finalCrc, size);
    yield desc;
    offset += desc.length;
    central.push(centralHeader(nameBytes, time, date, finalCrc, size, localOffset));
  }

  // The story card, last, after every photo has streamed. Rendered lazily here
  // so a slow composite never delays the first photo bytes, and skipped on any
  // failure so the photos always ship.
  if (card) {
    try {
      const bytes = await card.render();
      if (bytes) {
        const nameBytes = enc.encode(card.name);
        const local = localHeader(nameBytes, time, date);
        const localOffset = offset;
        yield local;
        offset += local.length;
        const crc = (crc32Update(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
        yield bytes;
        offset += bytes.length;
        const desc = dataDescriptor(crc, bytes.length);
        yield desc;
        offset += desc.length;
        central.push(centralHeader(nameBytes, time, date, crc, bytes.length, localOffset));
      }
    } catch {
      // Skip the card, keep the photos.
    }
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const c of central) {
    cdSize += c.length;
    yield c;
  }
  yield endOfCentral(central.length, cdSize, cdOffset);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await getGalleryByToken(token);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }
  if (isExpired(data.delivery.expires_at)) {
    return new Response("This gallery has expired.", { status: 410 });
  }
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  const admin = createAdminClient();
  const { data: photos } = await admin
    .from("photos")
    .select("storage_key, filename, size")
    .eq("delivery_id", data.delivery.id)
    .order("sort_order", { ascending: true });
  if (!photos?.length) {
    return new Response("No photos in this gallery.", { status: 404 });
  }
  const totalBytes = photos.reduce((s, p) => s + (Number(p.size) || 0), 0);
  if (totalBytes > MAX_ZIP_BYTES) {
    return new Response("This gallery is too large for a single zip. Download photos individually.", {
      status: 413,
    });
  }

  // The trigger, recorded once for the whole zip, same as any photo download.
  if (!preview) {
    const { error: evErr } = await admin
      .from("events")
      .insert({ recipient_id: data.recipient.id, type: "downloaded" });
    if (evErr) {
      console.error(
        `zip download event insert failed for recipient ${data.recipient.id}: ${evErr.message}`,
      );
    }
    after(() => sendReviewAskAfterDownload(data.recipient.id, CANONICAL_ORIGIN));
  }

  const names = entryNames(photos);
  const entries = photos.map((p, i) => ({ storage_key: p.storage_key as string, name: names[i] }));
  // Same filename the share flow uses; nudged only if a photo already took it.
  const cardName = names.includes("my-sighting.png") ? "my-sighting-card.png" : "my-sighting.png";
  const card = {
    name: cardName,
    render: async () => {
      const res = await renderGuestCard(data);
      return res ? new Uint8Array(await res.arrayBuffer()) : null;
    },
  };
  const it = zipParts(admin, entries, card);
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (e) {
        console.error(e instanceof Error ? e.message : "zip stream failed");
        controller.error(e);
      }
    },
    cancel() {
      it.return?.(undefined);
    },
  });

  const slug =
    data.operator.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";
  return new Response(stream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slug}-photos.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
