/*
  Photographer tip jar helpers. Link only: we store a provider and a normalized
  handle, and build the outbound payment URL at render time. The money goes
  straight from guest to photographer; Flukesend never processes or holds it.

  Plain module, safe on the client and the server.
*/

export type TipProvider = "venmo" | "cashapp" | "paypal";

export const TIP_PROVIDERS: {
  key: TipProvider;
  label: string; // the picker label
  // The small grey cue under the gallery button: "opens Venmo".
  verb: string;
  // What the handle looks like, shown as the input hint.
  hint: string;
}[] = [
  { key: "venmo", label: "Venmo", verb: "opens Venmo", hint: "your Venmo username" },
  { key: "cashapp", label: "Cash App", verb: "opens Cash App", hint: "your $cashtag" },
  { key: "paypal", label: "PayPal.me", verb: "opens PayPal", hint: "your PayPal.me name" },
];

export function isTipProvider(v: string | null | undefined): v is TipProvider {
  return v === "venmo" || v === "cashapp" || v === "paypal";
}

export function tipProviderLabel(provider: TipProvider): string {
  return TIP_PROVIDERS.find((p) => p.key === provider)?.label ?? provider;
}

export function tipProviderVerb(provider: TipProvider): string {
  return TIP_PROVIDERS.find((p) => p.key === provider)?.verb ?? "opens the app";
}

/*
  Turn whatever the photographer pasted into a clean handle. They will paste
  bare handles, ones with a leading @ or $, or a full URL. Strip the protocol,
  the known provider domains, a leading @ or $, and any slashes, leaving just
  the handle. Returns "" when nothing usable is left.
*/
export function normalizeTipHandle(raw: string): string {
  let h = (raw ?? "").trim();
  if (!h) return "";
  // Drop a protocol and everything up to the last path segment for full URLs,
  // e.g. https://venmo.com/u/jake-smith or cash.app/$jake -> the last segment.
  if (/[./]/.test(h) && /venmo\.com|cash\.app|paypal\.me|paypal\.com/i.test(h)) {
    h = h.replace(/^https?:\/\//i, "");
    // Everything after the last slash is the handle (u/handle, $handle, handle).
    const parts = h.split("/").filter(Boolean);
    h = parts[parts.length - 1] ?? "";
  }
  // Strip a leading @ (Venmo/PayPal style) or $ (Cash App cashtag), and any
  // stray whitespace or trailing slash.
  h = h.replace(/^[@$]+/, "").replace(/\/+$/, "").trim();
  // A handle never contains spaces; keep only the first token if any slipped in.
  h = h.split(/\s+/)[0] ?? "";
  return h;
}

// The outbound payment URL for a provider and clean handle. Cash App uses a
// $cashtag in the path; Venmo uses /u/handle; PayPal.me uses the bare handle.
export function buildTipUrl(provider: TipProvider, handle: string): string {
  const h = encodeURIComponent(handle);
  switch (provider) {
    case "venmo":
      return `https://venmo.com/u/${h}`;
    case "cashapp":
      return `https://cash.app/$${h}`;
    case "paypal":
      return `https://paypal.me/${h}`;
  }
}

// A friendly first name from whatever we know about the photographer: their set
// display name, else the credited name on the send, else the email local part.
// Just the first word, title cased if it came from an email.
export function tipFirstName(
  displayName: string | null,
  creditedName: string | null,
  email: string | null,
): string {
  const source = (displayName || creditedName || "").trim();
  if (source) return source.split(/\s+/)[0];
  const local = (email || "").split("@")[0].split(/[._-]+/)[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return "your photographer";
}
