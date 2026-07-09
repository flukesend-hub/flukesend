"use client";

/*
  The Team section: who shares this operator account, and the owner's controls to
  invite a teammate by email or revoke a pending invite. Everyone here logs in
  separately but works under the same operator (shared branding, one bill). The
  join flow that turns an invite into a member lands in the next step; for now
  this is the owner-facing management.
*/
import { useActionState } from "react";
import { createInvite, revokeInvite, type SettingsState } from "./actions";

type Member = { email: string; role: string };
type Invite = { id: string; email: string };

export function TeamManager({
  members,
  invites,
  isOwner,
}: {
  members: Member[];
  invites: Invite[];
  isOwner: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(createInvite, undefined);

  return (
    <div>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        Everyone on your team shares this account and its branding. Invite a
        teammate by email and they join under this same operator, with their own
        login, able to create sends.
      </p>

      <div style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 6px" }}>On the team</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: isOwner ? "20px" : "0" }}>
        {members.map((m) => (
          <div key={m.email} style={row}>
            <span style={{ fontSize: "13px" }}>{m.email}</span>
            <span style={badge}>{m.role === "owner" ? "Owner" : "Member"}</span>
          </div>
        ))}
      </div>

      {isOwner ? (
        <>
          {invites.length ? (
            <>
              <div style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 6px" }}>Invited, not joined yet</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                {invites.map((i) => (
                  <div key={i.id} style={row}>
                    <span style={{ fontSize: "13px" }}>{i.email}</span>
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={i.id} />
                      <button type="submit" className="fl-link" style={{ fontSize: "12.5px" }}>
                        Revoke
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <form action={formAction}>
            <label style={{ display: "block", marginBottom: "10px" }}>
              <span className="fl-label-text">Invite a teammate</span>
              <input name="email" type="email" required placeholder="photographer@email.com" className="fl-input" />
            </label>
            {state?.error ? <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 10px" }}>{state.error}</p> : null}
            {state?.ok ? <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 10px" }}>{state.ok}</p> : null}
            <button type="submit" disabled={pending} className="fl-btn-ghost" style={{ fontSize: "13px" }}>
              {pending ? "Adding..." : "Add invite"}
            </button>
          </form>
        </>
      ) : (
        <p className="fl-hint" style={{ margin: "12px 0 0" }}>Only the account owner can invite teammates.</p>
      )}
    </div>
  );
}

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  padding: "9px 11px",
  border: "1px solid var(--line)",
  borderRadius: "10px",
  background: "var(--ink)",
};
const badge: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--muted)",
  border: "1px solid var(--line-strong)",
  borderRadius: "999px",
  padding: "2px 8px",
};
