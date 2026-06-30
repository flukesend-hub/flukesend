"use client";

/*
  Website and social links card, dark workspace styling. One row per platform:
  a small platform icon, then the link field. Saves all six at once through
  updateSocialLinks. These render as icons in the footer of the delivery and
  review emails. No em dashes anywhere.
*/
import { useActionState } from "react";
import { updateSocialLinks, type SettingsState } from "./actions";
import { SOCIAL_PLATFORMS, type SocialKey, type SocialLinks } from "@/lib/social";

// Browser only icons, so inline SVG is fine here (email uses raster icons).
function SocialIcon({ name }: { name: SocialKey }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true,
  } as const;
  switch (name) {
    case "website":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.2-1.4 1.4-1.4h1.4V5.5c-.7-.1-1.5-.2-2.3-.2-2.3 0-3.9 1.4-3.9 4v2.2H7.8V14h2.2v7z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14 3c.3 2.3 1.7 3.8 4 4v2.7c-1.4 0-2.7-.4-4-1.1V15a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v2.8a2.7 2.7 0 102 2.6V3z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M22 12s0-3-.4-4.4a2.6 2.6 0 00-1.8-1.8C18.3 5.4 12 5.4 12 5.4s-6.3 0-7.8.4a2.6 2.6 0 00-1.8 1.8C2 9 2 12 2 12s0 3 .4 4.4c.3 1 .9 1.6 1.8 1.8 1.5.4 7.8.4 7.8.4s6.3 0 7.8-.4a2.6 2.6 0 001.8-1.8C22 15 22 12 22 12zm-12 2.6V9.4l4.5 2.6z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M17.5 3h2.8l-6.1 7 7.2 11h-5.6l-4.4-6.4L6 21H3.2l6.5-7.5L2.8 3h5.7l4 5.9zm-1 16h1.5L7.6 4.6H6z" />
        </svg>
      );
  }
}

export function SocialLinksForm({ links }: { links: SocialLinks }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateSocialLinks,
    undefined,
  );

  return (
    <div>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        Add any you have. They show up as icons in the footer of your guest
        emails. Leave one blank to hide it.
      </p>

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {SOCIAL_PLATFORMS.map((platform) => (
          <label key={platform.key} style={row}>
            <span style={iconBox} title={platform.label}>
              <SocialIcon name={platform.key} />
            </span>
            <span style={{ width: "82px", fontSize: "13px", color: "var(--muted)" }}>
              {platform.label}
            </span>
            <input
              name={platform.key}
              className="fl-input"
              style={{ flex: 1, fontSize: "13px", padding: "9px 11px", borderRadius: "9px" }}
              defaultValue={links[platform.column] ?? ""}
              placeholder={platform.placeholder}
            />
          </label>
        ))}

        {state?.error ? (
          <p style={{ color: "var(--bad)", fontSize: "13px", margin: "4px 0 0" }}>{state.error}</p>
        ) : null}
        {state?.ok ? (
          <p style={{ color: "var(--good)", fontSize: "13px", margin: "4px 0 0" }}>{state.ok}</p>
        ) : null}

        <button type="submit" disabled={pending} className="fl-btn" style={{ alignSelf: "flex-start", marginTop: "4px" }}>
          {pending ? "Saving..." : "Save links"}
        </button>
      </form>
    </div>
  );
}

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};
const iconBox: React.CSSProperties = {
  width: "34px",
  height: "34px",
  flex: "0 0 auto",
  borderRadius: "9px",
  display: "grid",
  placeItems: "center",
  background: "var(--line)",
  color: "var(--text)",
};
