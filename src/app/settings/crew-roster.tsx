"use client";

/*
  Crew roster with role tags and faces. Each person shows their photo (or an
  initials circle), their name, a row of role toggles, a photo control, and a
  "show to guests" switch. Roles decide which dropdown the person appears in on
  a send. The photo and the show flag drive the crew faces on the review email.
  Each card is its own component so it can own its photo upload state.
*/
import { useActionState, useState, useTransition } from "react";
import { CREW_ROLES } from "@/lib/roles";
import { avatarInitials, avatarColor } from "@/lib/avatar";
import type { SettingsState } from "./actions";

type Member = {
  id: string;
  name: string;
  roles: string[];
  photoUrl: string | null;
  showToGuests: boolean;
};

type Actions = {
  deleteAction: (fd: FormData) => void | Promise<void>;
  setRolesAction: (id: string, roles: string[]) => Promise<void>;
  setPhotoAction: (prev: SettingsState, fd: FormData) => Promise<SettingsState>;
  removePhotoAction: (id: string) => Promise<void>;
  setShowAction: (id: string, show: boolean) => Promise<void>;
};

export function CrewRoster({
  items,
  addAction,
  ...actions
}: {
  items: Member[];
  addAction: (prev: SettingsState, fd: FormData) => Promise<SettingsState>;
} & Actions) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    addAction,
    undefined,
  );

  return (
    <div>
      <h4 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600 }}>Employees</h4>
      <p className="fl-hint" style={{ margin: "0 0 12px" }}>
        Add your team once and tag what each one does. On a send you just check
        who was aboard, and we credit them by their role. Add a photo and their
        face can warm up the review email.
      </p>

      {items.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "12px" }}>
          {items.map((m) => (
            <CrewCard key={m.id} m={m} {...actions} />
          ))}
        </div>
      ) : (
        <p className="fl-hint" style={{ margin: "0 0 12px" }}>
          No employees yet.
        </p>
      )}

      <form action={formAction} style={{ display: "flex", gap: "8px" }}>
        <input name="name" className="fl-input" style={{ fontSize: "13px", padding: "9px 11px" }} placeholder="Add a name" />
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

function CrewCard({
  m,
  deleteAction,
  setRolesAction,
  setPhotoAction,
  removePhotoAction,
  setShowAction,
}: { m: Member } & Actions) {
  const [rolesOverlay, setRolesOverlay] = useState<string[] | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean | null>(null);
  const [, startTransition] = useTransition();
  const [photoState, photoAction, photoPending] = useActionState<SettingsState, FormData>(
    setPhotoAction,
    undefined,
  );

  const roles = rolesOverlay ?? m.roles ?? [];
  const show = showOverlay ?? m.showToGuests;

  function toggleRole(role: string) {
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    setRolesOverlay(next);
    startTransition(() => setRolesAction(m.id, next));
  }
  function toggleShow() {
    const next = !show;
    setShowOverlay(next);
    startTransition(() => setShowAction(m.id, next));
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {m.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photoUrl} alt={m.name} style={avatarImg} />
        ) : (
          <span style={{ ...avatarFallback, background: avatarColor(m.name) }}>{avatarInitials(m.name)}</span>
        )}
        <span style={{ fontSize: "13.5px", fontWeight: 600, flex: 1, minWidth: 0 }}>{m.name}</span>
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
            <button key={r.key} type="button" onClick={() => toggleRole(r.key)} aria-pressed={on} style={roleChip(on)}>
              {r.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "10px" }}>
        <form action={photoAction}>
          <input type="hidden" name="crew_id" value={m.id} />
          <label style={photoLink}>
            {photoPending ? "Uploading..." : m.photoUrl ? "Replace photo" : "Add photo"}
            <input
              type="file"
              name="photo"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              style={{ display: "none" }}
              disabled={photoPending}
            />
          </label>
        </form>
        {m.photoUrl ? (
          <button type="button" onClick={() => startTransition(() => removePhotoAction(m.id))} style={photoLink}>
            Remove photo
          </button>
        ) : null}
        <button type="button" onClick={toggleShow} aria-pressed={show} style={{ ...showChip(show), marginLeft: "auto" }}>
          {show ? "Shown to guests" : "Hidden from guests"}
        </button>
      </div>
      {photoState?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "12px", margin: "8px 0 0" }}>{photoState.error}</p>
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
const avatarImg: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  objectFit: "cover",
  flex: "0 0 auto",
  display: "block",
};
const avatarFallback: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontWeight: 600,
  fontSize: "15px",
  flex: "0 0 auto",
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
const photoLink: React.CSSProperties = {
  font: "inherit",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--signal)",
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};
const showChip = (on: boolean): React.CSSProperties => ({
  font: "inherit",
  fontSize: "11.5px",
  fontWeight: 600,
  border: `1px solid ${on ? "var(--line-strong)" : "var(--bad)"}`,
  background: "transparent",
  color: on ? "var(--muted)" : "var(--bad)",
  borderRadius: "999px",
  padding: "4px 10px",
  cursor: "pointer",
});
