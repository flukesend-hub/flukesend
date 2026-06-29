"use client";

/*
  The send form. Trip details are plain fields. Photos upload straight to
  Storage from the browser using signed URLs, so large sets never hit the
  server. The email box takes a paste in any format and shows live chips: valid
  ones to keep, bad ones flagged, duplicates dropped. On submit it uploads, then
  records the delivery, then goes to the confirmation page.
*/
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { signUploads, createSend } from "./actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string) {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const tokenRaw of raw.split(/[\s,;]+/)) {
    const token = tokenRaw.trim().toLowerCase();
    if (!token) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    if (EMAIL_RE.test(token)) valid.push(token);
    else invalid.push(token);
  }
  return { valid, invalid };
}

function splitList(raw: string) {
  return raw
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Status = "idle" | "uploading" | "saving";

export function SendForm({ defaultMessage }: { defaultMessage: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [emailsRaw, setEmailsRaw] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseEmails(emailsRaw), [emailsRaw]);
  const busy = status !== "idle";

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    setFiles((prev) => {
      const key = (f: File) => `${f.name}:${f.size}`;
      const have = new Set(prev.map(key));
      return [...prev, ...incoming.filter((f) => !have.has(key(f)))];
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const tripDatetime = String(fd.get("trip_datetime") ?? "") || null;
    const whaleCountRaw = String(fd.get("whale_count") ?? "").trim();
    const whaleCount = whaleCountRaw ? Number(whaleCountRaw) : null;
    const species = splitList(String(fd.get("species") ?? ""));
    const captainName = String(fd.get("captain_name") ?? "").trim() || null;
    const crewNames = splitList(String(fd.get("crew_names") ?? ""));
    const customMessage = String(fd.get("custom_message") ?? "").trim() || null;

    if (!files.length) {
      setError("Add at least one photo.");
      return;
    }
    if (!parsed.valid.length) {
      setError("Add at least one valid guest email.");
      return;
    }

    try {
      setStatus("uploading");
      setUploaded(0);

      const signRes = await signUploads(
        files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      );
      if ("error" in signRes) {
        setError(signRes.error);
        setStatus("idle");
        return;
      }

      const supabase = createClient();
      const photos: { storageKey: string; filename: string; size: number }[] = [];
      for (let i = 0; i < signRes.uploads.length; i++) {
        const u = signRes.uploads[i];
        const file = files[i];
        const { error: upErr } = await supabase.storage
          .from("photos")
          .uploadToSignedUrl(u.path, u.token, file, { contentType: file.type });
        if (upErr) {
          setError(`Upload failed for "${file.name}". Try again.`);
          setStatus("idle");
          return;
        }
        photos.push({ storageKey: u.path, filename: file.name, size: file.size });
        setUploaded(i + 1);
      }

      setStatus("saving");
      const res = await createSend({
        tripDatetime,
        whaleCount,
        species,
        captainName,
        crewNames,
        customMessage,
        photos,
        emails: parsed.valid,
      });
      if ("error" in res) {
        setError(res.error);
        setStatus("idle");
        return;
      }

      router.push(`/deliveries/${res.deliveryId}`);
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("idle");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={styles.form}>
      <Field label="Trip date and time">
        <input name="trip_datetime" type="datetime-local" style={styles.input} />
      </Field>

      <div style={styles.twoCol}>
        <Field label="Whales seen">
          <input
            name="whale_count"
            type="number"
            min={0}
            placeholder="7"
            style={styles.input}
          />
        </Field>
        <Field label="Captain">
          <input name="captain_name" placeholder="Captain Margo" style={styles.input} />
        </Field>
      </div>

      <Field label="Species" hint="Comma separated, e.g. Humpback, Orca">
        <input name="species" placeholder="Humpback, Orca" style={styles.input} />
      </Field>

      <Field label="Crew" hint="Comma separated">
        <input name="crew_names" placeholder="Sam, Dana" style={styles.input} />
      </Field>

      <Field
        label="Custom message"
        hint={
          defaultMessage
            ? "Leave blank to use your default message."
            : "Optional note shown to guests."
        }
      >
        <textarea
          name="custom_message"
          rows={2}
          placeholder={defaultMessage || "Thanks for joining us out on the water."}
          style={styles.textarea}
        />
      </Field>

      <Field label="Photos" hint="Uploaded straight to storage. Up to 50 MB each.">
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          style={{ fontSize: "0.85rem" }}
        />
        {files.length ? (
          <ul style={styles.fileList}>
            {files.map((f, i) => (
              <li key={`${f.name}:${f.size}:${i}`} style={styles.fileRow}>
                <span style={styles.fileName}>{f.name}</span>
                <span style={styles.fileMeta}>{fmtSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={busy}
                  style={styles.fileRemove}
                  aria-label={`Remove ${f.name}`}
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Field>

      <Field
        label="Guest emails"
        hint="Paste in any format. We split, lowercase, and dedupe. Each guest gets their own gallery."
      >
        <textarea
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          rows={3}
          placeholder="margo@example.com, dana@example.com sam@example.com"
          style={styles.textarea}
        />
        {parsed.valid.length || parsed.invalid.length ? (
          <div style={styles.chips}>
            {parsed.valid.map((e) => (
              <span key={e} style={{ ...styles.chip, ...styles.chipOk }}>
                {e}
              </span>
            ))}
            {parsed.invalid.map((e) => (
              <span key={e} style={{ ...styles.chip, ...styles.chipBad }}>
                {e} (invalid)
              </span>
            ))}
          </div>
        ) : null}
        {parsed.valid.length ? (
          <p style={styles.count}>
            {parsed.valid.length} guest{parsed.valid.length === 1 ? "" : "s"} will
            be sent this gallery.
          </p>
        ) : null}
      </Field>

      {error ? <p style={styles.error}>{error}</p> : null}

      <button type="submit" disabled={busy} style={styles.button}>
        {status === "uploading"
          ? `Uploading ${uploaded} of ${files.length}...`
          : status === "saving"
            ? "Creating send..."
            : "Create send"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.label}>
      {label}
      {hint ? <span style={styles.hint}>{hint}</span> : null}
      {children}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#334155",
  },
  hint: { fontWeight: 400, color: "#64748b", fontSize: "0.8rem" },
  input: {
    padding: "0.6rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
  },
  textarea: {
    padding: "0.6rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
    resize: "vertical",
    fontFamily: "inherit",
  },
  fileList: {
    listStyle: "none",
    margin: "0.5rem 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.85rem",
    fontWeight: 400,
  },
  fileName: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileMeta: { color: "#64748b" },
  fileRemove: {
    border: "1px solid #cbd5e1",
    background: "white",
    borderRadius: "0.3rem",
    cursor: "pointer",
    lineHeight: 1,
    padding: "0.1rem 0.4rem",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" },
  chip: {
    fontSize: "0.8rem",
    padding: "0.2rem 0.5rem",
    borderRadius: "999px",
    fontWeight: 400,
  },
  chipOk: { background: "#dcfce7", color: "#15803d" },
  chipBad: { background: "#fee2e2", color: "#b91c1c" },
  count: { margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#64748b", fontWeight: 400 },
  error: { color: "#b91c1c", fontSize: "0.85rem", margin: 0 },
  button: {
    padding: "0.75rem",
    borderRadius: "0.5rem",
    border: "none",
    background: "#0b5563",
    color: "white",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
  },
};
