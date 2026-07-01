"use client";

/*
  Add a forgotten guest to a send that already went out. One input and one
  button at the bottom of the guest list: the new guest gets their own gallery
  link emailed immediately and appears in the list on refresh.
*/
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addRecipient } from "./actions";

export function AddGuest({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setNote(null);
    const res = await addRecipient(deliveryId, email);
    setBusy(false);
    if ("error" in res) {
      setNote({ text: res.error, ok: false });
      return;
    }
    setNote(
      res.emailed
        ? { text: `Added and emailed ${res.email}.`, ok: true }
        : {
            text: `Added ${res.email}, but the email did not send. Use Resend on their row.`,
            ok: false,
          },
    );
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={add} style={{ marginTop: "14px" }}>
      <div className="fl-label-text" style={{ marginBottom: "6px" }}>
        Forgot someone?
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input
          className="fl-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="guest@email.com"
          style={{ flex: "1 1 200px", fontSize: "13.5px", padding: "9px 12px" }}
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="fl-btn"
          style={{ padding: "9px 16px", fontSize: "13.5px" }}
        >
          {busy ? "Adding..." : "Add and email"}
        </button>
      </div>
      <p className="fl-hint" style={{ margin: "7px 0 0" }}>
        They get their own gallery link and their own review ask, same as
        everyone else on this send.
      </p>
      {note ? (
        <p style={{ fontSize: "12.5px", color: note.ok ? "var(--good)" : "var(--bad)", margin: "7px 0 0" }}>
          {note.text}
        </p>
      ) : null}
    </form>
  );
}
