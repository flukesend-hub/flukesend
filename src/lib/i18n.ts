/*
  Guest-facing localization. The operator picks one language for their guests
  (English, French, or Spanish) at onboarding, stored on branding.guest_locale.
  Every guest-facing surface renders its structural strings from here, and the
  editable Branding copy falls back to a localized example the operator can
  rewrite (see brand-copy). Client safe on purpose: the Branding preview, the
  server email builders, and the guest pages all import this.

  Deliberately dependency free. The emails are built as HTML strings server
  side, so a full i18n runtime buys nothing; a typed dictionary with token
  substitution is enough, and it keeps every word a guest can see auditable in
  one file (which is also where a native speaker can proof the translations).
  Structural strings are trusted literals: callers escape the dynamic values
  they pass in, never the template. No em dashes in any copy here.
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

// Short codes for the compact language dropdown.
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "ENG",
  fr: "FR",
  es: "ESP",
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

// A trip time in the guest's language ("2:30 PM", "14:30"). Locale drives the
// clock style; null passes through.
export function formatTimeLocalized(
  datetime: string | null,
  locale: Locale,
): string | null {
  if (!datetime) return null;
  return new Date(datetime).toLocaleTimeString(LOCALE_TAG[locale], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---- Structural strings ----
// The parts of a guest surface the operator does not write: greetings, labels,
// subjects, buttons, the footer, the whole reminder and the guest pages. Keyed
// by a stable id; {tokens} are substituted by t(). Every key must exist in all
// three languages, enforced by the Record<Locale, Dict> type, so a missing
// translation fails the build, not a guest's inbox.
type Dict = {
  // Shared across surfaces.
  "email.greeting": string; // {name}
  "email.sentBy": string; // {name}
  "trip.captain": string; // {name}
  "trip.withCaptain": string; // {name}
  "trip.naturalist": string; // {name}
  "trip.photosBy": string; // {name}
  "list.and": string;
  "time.today": string;
  "time.tomorrow": string;

  // Delivery email.
  "delivery.subject": string; // {operator}
  "delivery.retention": string; // {days}
  "delivery.preheader": string;

  // Review email.
  "review.subject": string;
  "review.greetingNamed": string; // {name}
  "review.greetingPlain": string;
  "review.speciesLine": string; // {species}
  "review.crewToday": string;

  // Expiring-soon reminder.
  "reminder.subject.expiring": string;
  "reminder.subject.fixed": string;
  "reminder.headline.expiring": string;
  "reminder.headline.fixed": string;
  "reminder.body.expiring": string; // {when}
  "reminder.body.fixed": string; // {when}
  "reminder.preheader.expiring": string;
  "reminder.preheader.fixed": string;
  "reminder.button": string;
  "reminder.signoff": string; // {name}

  // Guest gallery page.
  "gallery.heroWithTime": string; // {time} {name}
  "gallery.heroWithCaptain": string; // {name}
  "gallery.heroDefault": string;
  "gallery.factAboard": string; // {name}
  "gallery.factNaturalist": string; // {name}
  "gallery.factPhotosBy": string; // {name}
  "gallery.expired": string;
  "gallery.expiredHelp": string; // {operator}
  "gallery.empty": string;
  "gallery.thanks": string;

  // Gallery, interactive save/download and post-save block.
  "gp.photosLive": string; // {count} {days}
  "gp.gettingPhoto": string; // {done} {total}
  "gp.readyTap": string; // {count}
  "gp.opening": string;
  "gp.saved": string;
  "gp.saveAll": string;
  "gp.downloaded": string;
  "gp.downloadAll": string;
  "gp.couldNotPrepare": string;
  "gp.shareFailed": string;
  "gp.zipInstead": string;
  "gp.savedToPhone": string;
  "gp.tipLedePre": string;
  "gp.tipButton": string; // {name}
  "gp.goesStraightTo": string; // {name}
  "gp.lovedIt": string;

  // QR capture page.
  "capture.title": string;
  "capture.subMulti": string;
  "capture.subSingle": string;
  "cf.whichBoat": string;
  "cf.chooseBoat": string;
  "cf.whichTrip": string; // {date}
  "cf.chooseTime": string;
  "cf.tripsAppear": string;
  "cf.dontSeeTrip": string;
  "cf.showAll": string;
  "cf.yourEmail": string;
  "cf.yourFirstName": string;
  "cf.firstNamePlaceholder": string;
  "cf.submit": string;
  "cf.saving": string;
  "cf.checkSpam": string;
  "cf.onList": string;
  "cf.willEmail": string; // {operator}
  "cf.follow": string; // {operator}
  "capture.err.inactive": string;
  "capture.err.email": string;
  "capture.err.pickBoat": string;
  "capture.err.pickTime": string;
  "capture.err.rate": string;
  "capture.err.save": string;
};

export type MessageKey = keyof Dict;

const MESSAGES: Record<Locale, Dict> = {
  en: {
    "email.greeting": "Hi {name},",
    "email.sentBy": "Sent by {name}",
    "trip.captain": "Captain {name}",
    "trip.withCaptain": "with Captain {name}",
    "trip.naturalist": "Naturalist {name}",
    "trip.photosBy": "Photos by {name}",
    "list.and": "and",
    "time.today": "today",
    "time.tomorrow": "tomorrow",

    "delivery.subject": "Your photos from {operator}",
    "delivery.retention":
      "Your gallery is up for {days} days, save your photos while it lasts.",
    "delivery.preheader":
      "Your photos from the trip are ready to view and download.",

    "review.subject": "How about those whales?",
    "review.greetingNamed":
      "Hi {name}, we hope you had an amazing time out on the water with us.",
    "review.greetingPlain":
      "We hope you had an amazing time out on the water with us.",
    "review.speciesLine": "It was a good one out there. {species}!",
    "review.crewToday": "Your crew today",

    "reminder.subject.expiring": "Don't let the whale slip away",
    "reminder.subject.fixed":
      "Your photo link may not have worked, here is a fresh one",
    "reminder.headline.expiring": "Don't let the whale slip away",
    "reminder.headline.fixed": "That link may not have worked. This one does.",
    "reminder.body.expiring":
      "The photos from your trip are still waiting, but not for much longer. Your gallery closes {when}. Make sure to download your photos to your phone before it does.",
    "reminder.body.fixed":
      "The button in our last email was not working for some guests. Here is a fresh link straight to your photos from the trip. Your gallery closes {when}, so save them to your phone while it is up.",
    "reminder.preheader.expiring":
      "Your trip photos are still waiting. Save them before the gallery closes.",
    "reminder.preheader.fixed":
      "A fresh, working link to your trip photos. Save them before the gallery closes.",
    "reminder.button": "Save your photos",
    "reminder.signoff":
      "Reply any time, it reaches us directly. Thank you, the crew at {name}.",

    "gallery.heroWithTime": "Your {time} trip with Captain {name}",
    "gallery.heroWithCaptain": "Your trip with Captain {name}",
    "gallery.heroDefault": "Your photos are ready",
    "gallery.factAboard": "aboard {name}",
    "gallery.factNaturalist": "naturalist {name}",
    "gallery.factPhotosBy": "photos by {name}",
    "gallery.expired": "This gallery has expired.",
    "gallery.expiredHelp": "Reach out to {operator} if you still need your photos.",
    "gallery.empty": "No photos in this gallery yet.",
    "gallery.thanks": "Thanks for spending the day on the water with us.",

    "gp.photosLive": "{count} photos · live for {days} days",
    "gp.gettingPhoto": "Getting photo {done} of {total}...",
    "gp.readyTap": "Ready. Tap to save {count} photos",
    "gp.opening": "Opening...",
    "gp.saved": "Saved",
    "gp.saveAll": "Save all to Photos",
    "gp.downloaded": "Downloaded",
    "gp.downloadAll": "Download all photos",
    "gp.couldNotPrepare": "Could not get the photos ready here.",
    "gp.shareFailed": "Sharing did not work here.",
    "gp.zipInstead": "Download everything as a zip instead",
    "gp.savedToPhone": "Saved to your phone.",
    "gp.tipLedePre": "Loved your trip? Your photos were shot by ",
    "gp.tipButton": "Tip {name}",
    "gp.goesStraightTo": "goes straight to {name}",
    "gp.lovedIt": "Loved it?",

    "capture.title": "Get your trip photos",
    "capture.subMulti":
      "Choose your boat and trip time, drop your email, and we will send your photos after the trip.",
    "capture.subSingle":
      "Choose your trip time, drop your email, and we will send your photos after the trip.",
    "cf.whichBoat": "Which boat were you on?",
    "cf.chooseBoat": "Choose your boat",
    "cf.whichTrip": "Which trip? (today, {date})",
    "cf.chooseTime": "Choose your trip time",
    "cf.tripsAppear": "Trips show up here once they have left the dock. ",
    "cf.dontSeeTrip": "Don't see your trip? ",
    "cf.showAll": "Show all times",
    "cf.yourEmail": "Your email",
    "cf.yourFirstName": "Your first name",
    "cf.firstNamePlaceholder": "First name",
    "cf.submit": "Send me my photos",
    "cf.saving": "Saving...",
    "cf.checkSpam": "Make sure to check your spam folder.",
    "cf.onList": "You are on the list.",
    "cf.willEmail":
      "{operator} will email your photos after the trip. If you do not see them, check your spam or junk folder. You can close this page.",
    "cf.follow": "Follow {operator}",
    "capture.err.inactive":
      "This link is no longer active. Ask the crew for a fresh one.",
    "capture.err.email": "That email does not look right. Give it another try.",
    "capture.err.pickBoat": "Pick which boat you were on.",
    "capture.err.pickTime": "Pick your trip time.",
    "capture.err.rate":
      "Too many sign ups from here just now. Wait a minute and retry.",
    "capture.err.save": "Could not save that just now. Please try again.",
  },

  fr: {
    "email.greeting": "Bonjour {name},",
    "email.sentBy": "Envoyé par {name}",
    "trip.captain": "capitaine {name}",
    "trip.withCaptain": "avec le capitaine {name}",
    "trip.naturalist": "Naturaliste {name}",
    "trip.photosBy": "Photos par {name}",
    "list.and": "et",
    "time.today": "aujourd'hui",
    "time.tomorrow": "demain",

    "delivery.subject": "Vos photos de {operator}",
    "delivery.retention":
      "Votre galerie est en ligne pendant {days} jours, enregistrez vos photos tant qu'elle est disponible.",
    "delivery.preheader":
      "Vos photos de la sortie sont prêtes, à voir et à télécharger.",

    "review.subject": "Alors, ces baleines ?",
    "review.greetingNamed":
      "Bonjour {name}, nous espérons que vous avez passé un moment formidable sur l'eau avec nous.",
    "review.greetingPlain":
      "Nous espérons que vous avez passé un moment formidable sur l'eau avec nous.",
    "review.speciesLine": "C'était une belle sortie. {species} !",
    "review.crewToday": "Votre équipage du jour",

    "reminder.subject.expiring": "Ne laissez pas filer la baleine",
    "reminder.subject.fixed":
      "Votre lien photo n'a peut-être pas fonctionné, en voici un nouveau",
    "reminder.headline.expiring": "Ne laissez pas filer la baleine",
    "reminder.headline.fixed":
      "Ce lien n'a peut-être pas fonctionné. Celui-ci fonctionne.",
    "reminder.body.expiring":
      "Les photos de votre sortie vous attendent encore, mais plus pour très longtemps. Votre galerie ferme {when}. Pensez à enregistrer vos photos sur votre téléphone avant.",
    "reminder.body.fixed":
      "Le bouton de notre dernier e-mail ne fonctionnait pas pour certains invités. Voici un nouveau lien direct vers vos photos de la sortie. Votre galerie ferme {when}, alors enregistrez-les sur votre téléphone tant qu'elle est en ligne.",
    "reminder.preheader.expiring":
      "Vos photos de la sortie vous attendent encore. Enregistrez-les avant la fermeture de la galerie.",
    "reminder.preheader.fixed":
      "Un nouveau lien qui fonctionne vers vos photos de la sortie. Enregistrez-les avant la fermeture de la galerie.",
    "reminder.button": "Enregistrer vos photos",
    "reminder.signoff":
      "Répondez à tout moment, cela nous parvient directement. Merci, l'équipage de {name}.",

    "gallery.heroWithTime": "Votre sortie de {time} avec le capitaine {name}",
    "gallery.heroWithCaptain": "Votre sortie avec le capitaine {name}",
    "gallery.heroDefault": "Vos photos sont prêtes",
    "gallery.factAboard": "à bord de {name}",
    "gallery.factNaturalist": "naturaliste {name}",
    "gallery.factPhotosBy": "photos par {name}",
    "gallery.expired": "Cette galerie a expiré.",
    "gallery.expiredHelp":
      "Contactez {operator} si vous avez encore besoin de vos photos.",
    "gallery.empty": "Aucune photo dans cette galerie pour l'instant.",
    "gallery.thanks": "Merci d'avoir passé la journée sur l'eau avec nous.",

    "gp.photosLive": "{count} photos · en ligne pendant {days} jours",
    "gp.gettingPhoto": "Photo {done} sur {total}...",
    "gp.readyTap": "Prêt. Touchez pour enregistrer {count} photos",
    "gp.opening": "Ouverture...",
    "gp.saved": "Enregistré",
    "gp.saveAll": "Tout enregistrer dans Photos",
    "gp.downloaded": "Téléchargé",
    "gp.downloadAll": "Télécharger toutes les photos",
    "gp.couldNotPrepare": "Impossible de préparer les photos ici.",
    "gp.shareFailed": "Le partage n'a pas fonctionné ici.",
    "gp.zipInstead": "Tout télécharger en zip à la place",
    "gp.savedToPhone": "Enregistré sur votre téléphone.",
    "gp.tipLedePre": "Vous avez aimé votre sortie ? Vos photos ont été prises par ",
    "gp.tipButton": "Pourboire pour {name}",
    "gp.goesStraightTo": "va directement à {name}",
    "gp.lovedIt": "Vous avez aimé ?",

    "capture.title": "Recevez vos photos de sortie",
    "capture.subMulti":
      "Choisissez votre bateau et l'heure de la sortie, laissez votre e-mail, et nous vous enverrons vos photos après la sortie.",
    "capture.subSingle":
      "Choisissez l'heure de la sortie, laissez votre e-mail, et nous vous enverrons vos photos après la sortie.",
    "cf.whichBoat": "Sur quel bateau étiez-vous ?",
    "cf.chooseBoat": "Choisissez votre bateau",
    "cf.whichTrip": "Quelle sortie ? (aujourd'hui, {date})",
    "cf.chooseTime": "Choisissez l'heure de la sortie",
    "cf.tripsAppear": "Les sorties apparaissent ici une fois qu'elles ont quitté le quai. ",
    "cf.dontSeeTrip": "Vous ne voyez pas votre sortie ? ",
    "cf.showAll": "Afficher toutes les heures",
    "cf.yourEmail": "Votre e-mail",
    "cf.yourFirstName": "Votre prénom",
    "cf.firstNamePlaceholder": "Prénom",
    "cf.submit": "Envoyez-moi mes photos",
    "cf.saving": "Envoi...",
    "cf.checkSpam": "Pensez à vérifier votre dossier spam.",
    "cf.onList": "Vous êtes sur la liste.",
    "cf.willEmail":
      "{operator} vous enverra vos photos par e-mail après la sortie. Si vous ne les voyez pas, vérifiez votre dossier spam ou indésirables. Vous pouvez fermer cette page.",
    "cf.follow": "Suivez {operator}",
    "capture.err.inactive":
      "Ce lien n'est plus actif. Demandez-en un nouveau à l'équipage.",
    "capture.err.email": "Cet e-mail semble incorrect. Réessayez.",
    "capture.err.pickBoat": "Indiquez sur quel bateau vous étiez.",
    "capture.err.pickTime": "Indiquez l'heure de votre sortie.",
    "capture.err.rate":
      "Trop d'inscriptions depuis cet appareil pour le moment. Attendez une minute et réessayez.",
    "capture.err.save": "Impossible d'enregistrer pour le moment. Veuillez réessayer.",
  },

  es: {
    "email.greeting": "Hola {name},",
    "email.sentBy": "Enviado por {name}",
    "trip.captain": "capitán {name}",
    "trip.withCaptain": "con el capitán {name}",
    "trip.naturalist": "Naturalista {name}",
    "trip.photosBy": "Fotos de {name}",
    "list.and": "y",
    "time.today": "hoy",
    "time.tomorrow": "mañana",

    "delivery.subject": "Tus fotos de {operator}",
    "delivery.retention":
      "Tu galería estará disponible durante {days} días, guarda tus fotos mientras puedas.",
    "delivery.preheader":
      "Tus fotos de la salida ya están listas para ver y descargar.",

    "review.subject": "¿Qué tal las ballenas?",
    "review.greetingNamed":
      "Hola {name}, esperamos que hayas pasado un momento increíble en el agua con nosotros.",
    "review.greetingPlain":
      "Esperamos que hayas pasado un momento increíble en el agua con nosotros.",
    "review.speciesLine": "¡Fue una gran salida! {species}.",
    "review.crewToday": "Tu tripulación de hoy",

    "reminder.subject.expiring": "No dejes escapar a la ballena",
    "reminder.subject.fixed":
      "Puede que tu enlace de fotos no funcionara, aquí tienes uno nuevo",
    "reminder.headline.expiring": "No dejes escapar a la ballena",
    "reminder.headline.fixed": "Ese enlace pudo fallar. Este funciona.",
    "reminder.body.expiring":
      "Las fotos de tu salida siguen esperando, pero no por mucho más. Tu galería cierra {when}. Asegúrate de guardar tus fotos en el teléfono antes.",
    "reminder.body.fixed":
      "El botón de nuestro último correo no funcionaba para algunos invitados. Aquí tienes un enlace nuevo directo a tus fotos de la salida. Tu galería cierra {when}, así que guárdalas en tu teléfono mientras esté disponible.",
    "reminder.preheader.expiring":
      "Tus fotos de la salida siguen esperando. Guárdalas antes de que cierre la galería.",
    "reminder.preheader.fixed":
      "Un enlace nuevo que funciona hacia tus fotos de la salida. Guárdalas antes de que cierre la galería.",
    "reminder.button": "Guarda tus fotos",
    "reminder.signoff":
      "Responde cuando quieras, nos llega directamente. Gracias, la tripulación de {name}.",

    "gallery.heroWithTime": "Tu salida de las {time} con el capitán {name}",
    "gallery.heroWithCaptain": "Tu salida con el capitán {name}",
    "gallery.heroDefault": "Tus fotos están listas",
    "gallery.factAboard": "a bordo de {name}",
    "gallery.factNaturalist": "naturalista {name}",
    "gallery.factPhotosBy": "fotos de {name}",
    "gallery.expired": "Esta galería ha caducado.",
    "gallery.expiredHelp":
      "Contacta con {operator} si todavía necesitas tus fotos.",
    "gallery.empty": "Aún no hay fotos en esta galería.",
    "gallery.thanks": "Gracias por pasar el día en el agua con nosotros.",

    "gp.photosLive": "{count} fotos · disponibles durante {days} días",
    "gp.gettingPhoto": "Foto {done} de {total}...",
    "gp.readyTap": "Listo. Toca para guardar {count} fotos",
    "gp.opening": "Abriendo...",
    "gp.saved": "Guardado",
    "gp.saveAll": "Guardar todo en Fotos",
    "gp.downloaded": "Descargado",
    "gp.downloadAll": "Descargar todas las fotos",
    "gp.couldNotPrepare": "No se pudieron preparar las fotos aquí.",
    "gp.shareFailed": "No se pudo compartir aquí.",
    "gp.zipInstead": "Descargar todo como zip",
    "gp.savedToPhone": "Guardado en tu teléfono.",
    "gp.tipLedePre": "¿Te encantó tu salida? Tus fotos las tomó ",
    "gp.tipButton": "Propina para {name}",
    "gp.goesStraightTo": "va directamente a {name}",
    "gp.lovedIt": "¿Te gustó?",

    "capture.title": "Recibe tus fotos de la salida",
    "capture.subMulti":
      "Elige tu barco y la hora de la salida, deja tu correo y te enviaremos tus fotos después de la salida.",
    "capture.subSingle":
      "Elige la hora de la salida, deja tu correo y te enviaremos tus fotos después de la salida.",
    "cf.whichBoat": "¿En qué barco ibas?",
    "cf.chooseBoat": "Elige tu barco",
    "cf.whichTrip": "¿Qué salida? (hoy, {date})",
    "cf.chooseTime": "Elige la hora de la salida",
    "cf.tripsAppear": "Las salidas aparecen aquí una vez que han salido del muelle. ",
    "cf.dontSeeTrip": "¿No ves tu salida? ",
    "cf.showAll": "Mostrar todas las horas",
    "cf.yourEmail": "Tu correo",
    "cf.yourFirstName": "Tu nombre",
    "cf.firstNamePlaceholder": "Nombre",
    "cf.submit": "Envíame mis fotos",
    "cf.saving": "Enviando...",
    "cf.checkSpam": "Recuerda revisar tu carpeta de spam.",
    "cf.onList": "Ya estás en la lista.",
    "cf.willEmail":
      "{operator} te enviará tus fotos por correo después de la salida. Si no las ves, revisa tu carpeta de spam o correo no deseado. Puedes cerrar esta página.",
    "cf.follow": "Sigue a {operator}",
    "capture.err.inactive":
      "Este enlace ya no está activo. Pide uno nuevo a la tripulación.",
    "capture.err.email": "Ese correo no parece correcto. Inténtalo de nuevo.",
    "capture.err.pickBoat": "Indica en qué barco ibas.",
    "capture.err.pickTime": "Indica la hora de tu salida.",
    "capture.err.rate":
      "Demasiados registros desde aquí ahora mismo. Espera un minuto y reinténtalo.",
    "capture.err.save": "No se pudo guardar ahora mismo. Inténtalo de nuevo.",
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
