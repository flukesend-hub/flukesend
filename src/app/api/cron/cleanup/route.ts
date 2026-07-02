/*
  Nightly storage cleanup. Two sweeps, both idempotent:

  1. Expired deliveries: every delivery stamps expires_at, and the gallery
     already refuses access past it. This removes the actual storage objects
     so expired photos stop costing money, then stamps cleaned_at. Photo rows
     and events stay so history and analytics are untouched.

  2. Orphaned uploads: signUploads mints storage paths before createSend runs,
     so an abandoned send leaves files with no photos row pointing at them.
     Anything unreferenced and older than the grace window is removed. The
     grace window keeps in-flight sends safe.

  Guardrails: the orphan sweep aborts if the photos table cannot be read
  (an empty reference set must mean genuinely empty, not a failed query), and
  ?dry=1 reports what would be deleted without deleting anything.
*/
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

// Uploads younger than this are never treated as orphans: a crew member may
// still be mid-send, or a retry may be about to reference them.
const ORPHAN_GRACE_HOURS = 48;
// Storage remove() takes a key list; keep batches modest.
const REMOVE_BATCH = 100;
const LIST_PAGE = 1000;

function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("Cron secret not configured", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";

  const admin = createAdminClient();
  const summary = {
    dry,
    expiredDeliveries: 0,
    expiredObjectsRemoved: 0,
    orphanObjectsRemoved: 0,
    errors: [] as string[],
  };

  // ---- Sweep 1: expired deliveries not yet cleaned ----
  const { data: expired, error: expErr } = await admin
    .from("deliveries")
    .select("id, expires_at")
    .lt("expires_at", new Date().toISOString())
    .is("cleaned_at", null)
    .limit(500);
  if (expErr) {
    summary.errors.push(`expired query failed: ${expErr.message}`);
  }
  for (const d of expired ?? []) {
    const { data: photos, error: phErr } = await admin
      .from("photos")
      .select("storage_key")
      .eq("delivery_id", d.id);
    if (phErr) {
      summary.errors.push(`photos query failed for delivery ${d.id}: ${phErr.message}`);
      continue;
    }
    const keys = (photos ?? []).map((p) => p.storage_key as string).filter(Boolean);
    let failed = false;
    if (!dry) {
      for (const batch of chunks(keys, REMOVE_BATCH)) {
        const { error: rmErr } = await admin.storage.from("photos").remove(batch);
        if (rmErr) {
          summary.errors.push(`remove failed for delivery ${d.id}: ${rmErr.message}`);
          failed = true;
          break;
        }
      }
      if (failed) {
        continue; // cleaned_at stays null, retried tomorrow
      }
      const { error: markErr } = await admin
        .from("deliveries")
        .update({ cleaned_at: new Date().toISOString() })
        .eq("id", d.id);
      if (markErr) {
        // Objects are gone but the mark failed; tomorrow's remove of missing
        // keys is a no-op, so this only costs a retry.
        summary.errors.push(`cleaned_at update failed for delivery ${d.id}: ${markErr.message}`);
      }
    }
    summary.expiredDeliveries++;
    summary.expiredObjectsRemoved += keys.length;
  }

  // ---- Sweep 2: orphaned uploads ----
  // Reference set: every storage key any photos row points at. Abort the
  // sweep entirely if this read fails; an accidentally empty set would mark
  // every object an orphan.
  const { data: refRows, error: refErr } = await admin
    .from("photos")
    .select("storage_key")
    .limit(500000);
  if (refErr) {
    summary.errors.push(`reference set query failed, orphan sweep skipped: ${refErr.message}`);
    return Response.json(summary);
  }
  const referenced = new Set((refRows ?? []).map((r) => r.storage_key as string));

  const graceCutoff = Date.now() - ORPHAN_GRACE_HOURS * 60 * 60 * 1000;
  const orphans: string[] = [];

  // The bucket is laid out operator/send/file. list() is per folder, so walk
  // the two folder levels and page through the files in each send folder.
  const { data: operators, error: opErr } = await admin.storage.from("photos").list("", {
    limit: LIST_PAGE,
  });
  if (opErr) {
    summary.errors.push(`bucket list failed: ${opErr.message}`);
    return Response.json(summary);
  }
  for (const op of operators ?? []) {
    if (op.name.startsWith(".")) continue;
    const { data: sends, error: sendErr } = await admin.storage
      .from("photos")
      .list(op.name, { limit: LIST_PAGE });
    if (sendErr) {
      summary.errors.push(`list failed for ${op.name}: ${sendErr.message}`);
      continue;
    }
    for (const send of sends ?? []) {
      if (send.name.startsWith(".")) continue;
      const prefix = `${op.name}/${send.name}`;
      for (let offset = 0; ; offset += LIST_PAGE) {
        const { data: files, error: fileErr } = await admin.storage
          .from("photos")
          .list(prefix, { limit: LIST_PAGE, offset });
        if (fileErr) {
          summary.errors.push(`list failed for ${prefix}: ${fileErr.message}`);
          break;
        }
        for (const f of files ?? []) {
          if (f.name.startsWith(".") || !f.created_at) continue;
          const key = `${prefix}/${f.name}`;
          if (!referenced.has(key) && new Date(f.created_at).getTime() < graceCutoff) {
            orphans.push(key);
          }
        }
        if (!files || files.length < LIST_PAGE) break;
      }
    }
  }

  if (!dry) {
    for (const batch of chunks(orphans, REMOVE_BATCH)) {
      const { error: rmErr } = await admin.storage.from("photos").remove(batch);
      if (rmErr) {
        summary.errors.push(`orphan remove failed: ${rmErr.message}`);
        break;
      }
      summary.orphanObjectsRemoved += batch.length;
    }
  } else {
    summary.orphanObjectsRemoved = orphans.length;
  }

  for (const e of summary.errors) {
    console.error(`cleanup cron: ${e}`);
  }
  // In dry mode, list what would go (capped) so a human can eyeball it.
  if (dry) {
    return Response.json({ ...summary, orphanKeys: orphans.slice(0, 200) });
  }
  return Response.json(summary);
}
