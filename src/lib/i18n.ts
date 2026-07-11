/*
  Guest-facing localization. The operator picks one language for their guests
  (English, French, or Spanish) at onboarding, stored on branding.guest_locale.
  Every guest-facing surface renders its structural strings from here, and the
  editable Branding copy falls back to a localized example the operator can
  rewrite (see brand-copy). Client safe on purpose: the Branding preview and the
  server email builders both import this.

  Deliberately dependency free. The emails are built as HTML strings server
  side, so a full i18n runtime buys nothing; a typed dictionary with token
  substitution is enough, and it keeps every word a guest can see auditable in
  one file. Structural strings are trusted literals: callers escape the dynamic
  values they pass in, never the template. No em dashes in any copy here.
*/

export const LOCALES = ["en", "fr", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

// Coerce a db value or a form field to a known locale, English by default, so a
// missing or unexpected value never throws on a guest surface.
export function asLocale(v: unknown): Locale {
  return isLocale(v) ? v : "en";
}

// The language's own name, for the picker. Written in-language on purpose: an
// operator scanning the list finds their language the way they write it.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
};

// BCP-47 tag for Intl date formatting.
const LOCALE_TAG: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
};

// A trip date in the guest's language, long form ("July 10", "10 juillet",
// "10 de julio"). Null passes through so callers keep their own empty handling.
export function formatDateLocalized(
  datetime: string | null,
  locale: Locale,
  opts?: { utc?: boolean },
): string | null {
  if (!datetime) return null;
  return new Date(datetime).toLocaleDateString(LOCALE_TAG[locale], {
    dateStyle: "long",
    ...(opts?.utc ? { timeZone: "UTC" } : {}),
  });
}

// ---- Structural strings ----
// The parts of a guest surface the operator does not write: greetings, the
// trip-card labels, the subject, the footer. Keyed by a stable id; {tokens} are
// substituted by t(). Every key must exist in all three languages, enforced by
// the Record<Locale, Dict> type, so a missing translation fails the build, not
// a guest's inbox.
type Dict = {
  "delivery.subject": string; // {operator}
  "email.greeting": string; // {name}
  "delivery.retention": string; // {days}
  "delivery.preheader": string;
  "trip.captain": string; // {name}
  "trip.withCaptain": string; // {name}
  "trip.naturalist": string; // {name}
  "trip.photosBy": string; // {name}
  "email.sentBy": string; // {name}
};

export type MessageKey = keyof Dict;

const MESSAGES: Record<Locale, Dict> = {
  en: {
    "delivery.subject": "Your photos from {operator}",
    "email.greeting": "Hi {name},",
    "delivery.retention":
      "Your gallery is up for {days} days, save your photos while it lasts.",
    "delivery.preheader":
      "Your photos from the trip are ready to view and download.",
    "trip.captain": "Captain {name}",
    "trip.withCaptain": "with Captain {name}",
    "trip.naturalist": "Naturalist {name}",
    "trip.photosBy": "Photos by {name}",
    "email.sentBy": "Sent by {name}",
  },
  fr: {
    "delivery.subject": "Vos photos de {operator}",
    "email.greeting": "Bonjour {name},",
    "delivery.retention":
      "Votre galerie est en ligne pendant {days} jours, enregistrez vos photos tant qu'elle est disponible.",
    "delivery.preheader":
      "Vos photos de la sortie sont prêtes, à voir et à télécharger.",
    "trip.captain": "capitaine {name}",
    "trip.withCaptain": "avec le capitaine {name}",
    "trip.naturalist": "Naturaliste {name}",
    "trip.photosBy": "Photos par {name}",
    "email.sentBy": "Envoyé par {name}",
  },
  es: {
    "delivery.subject": "Tus fotos de {operator}",
    "email.greeting": "Hola {name},",
    "delivery.retention":
      "Tu galería estará disponible durante {days} días, guarda tus fotos mientras puedas.",
    "delivery.preheader":
      "Tus fotos de la salida ya están listas para ver y descargar.",
    "trip.captain": "capitán {name}",
    "trip.withCaptain": "con el capitán {name}",
    "trip.naturalist": "Naturalista {name}",
    "trip.photosBy": "Fotos de {name}",
    "email.sentBy": "Enviado por {name}",
  },
};

// Look up a structural string and substitute {tokens}. The template is a
// trusted literal; callers pass already-escaped values for anything that lands
// in HTML, and raw values for plain-text slots like the subject.
export function t(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let s = MESSAGES[locale][key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
