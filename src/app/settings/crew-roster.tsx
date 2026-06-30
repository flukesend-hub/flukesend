"use client";

/*
  Crew roster with role tags. Each person shows their name, a row of role
  toggles (Captain, Crew, Naturalist, Photographer), and a remove control. The
  roles decide which dropdown the person appears in on the send form. Toggles
  update optimistically and persist through setCrewRoles; add and remove reuse
  the same server actions as the simple roster.
*/
import { useActionState, useState, useTransition } from "react";
import { CREW_ROLES } from "@/lib/roles";
import type { SettingsState } from "./actions";

type Member = { id: string; name: string; roles: string[] };

export function CrewRoster({
  items,
  addAction,
  deleteAction,
  setRolesAction,
}: {
  items: Member[];
  addAction: (prev: SettingsState, fd: FormData) => Promise<SettingsState>;
  deleteAction: (fd: FormData) => void | Promise<void>;
  setRolesAction: (id: string, roles: string[]) => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    addAction,
    undefined,
  );
  // Optimistic overlay of role changes, keyed by member id. Falls back to the
  // server value for anyone not toggled yet.
  const [overlay, setOverlay] = useState<Record<string, string[]>>({});
  const [, startTransition] = useTransition();

  function rolesFor(m: Member) {
    return overlay[m.id] ?? m.roles ?? [];
  }

  function toggleRole(m: Member, role: string) {
    const current = rolesFor(m);
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setOverlay((o) => ({ ...o, [m.id]: next }));
    startTransition(() => {
      setRolesAction(m.id, next);
    });
  }

  return (
    <div>
      <h4 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600 }}>Crew</h4>
      <p className="fl-hint" style={{ margin: "0 0 12px" }}>
        Add your people once, then tag what each one does. On a send you just
        pick from a dropdown per role.
      </p>

      {items.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "12px" }}>
          {items.map((m) => {
            const roles = rolesFor(m);
            return (
              <div key={m.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ fontSize: "13.5px", fontWeight: 600 }}>{m.name}</span>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" title="Remove" style={removeBtn}>
                      {"×"}
                    </button>
                  </form>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "9px" }}>
                  {CREW_ROLES.map((r) => {
                    const on = roles.includes(r.key);
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => toggleRole(m, r.key)}
                        aria-pressed={on}
                        style={roleChip(on)}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="fl-hint" style={{ margin: "0 0 12px" }}>
          No crew yet.
        </p>
      )}

      <form action={formAction} style={{ display: "flex", gap: "8px" }}>
        <input name="name" className="fl-input" style={{ fontSize: "13px", padding: "9px 11px" }} placeholder="Margo" />
        <button type="submit" disabled={pending} className="fl-btn-ghost" style={{ flex: "0 0 auto" }}>
          {pending ? "Adding..." : "Add person"}
        </button>
      </form>
      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "12.5px", margin: "8px 0 0" }}>{state.error}</p>
      ) : null}
    </div>
  );
}

const card: React.CSSProperties = {
  padding: "11px 12px",
  borderRadius: "11px",
  border: "1px solid var(--line)",
  background: "var(--ink)",
};
const removeBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line-strong)",
  color: "var(--muted)",
  borderRadius: "8px",
  cursor: "pointer",
  width: "30px",
  height: "28px",
  fontSize: "15px",
  flex: "0 0 auto",
};
const roleChip = (on: boolean): React.CSSProperties => ({
  font: "inherit",
  fontSize: "12px",
  fontWeight: on ? 600 : 500,
  border: `1px solid ${on ? "var(--signal)" : "var(--line-strong)"}`,
  background: on ? "var(--signal)" : "transparent",
  color: on ? "var(--signal-ink)" : "var(--muted)",
  borderRadius: "999px",
  padding: "5px 11px",
  cursor: "pointer",
});
