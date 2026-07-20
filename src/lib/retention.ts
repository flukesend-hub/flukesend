/*
  When a delivery expires. Anchored to the operator's local calendar day, not
  the exact send instant: a send at any time of day stays live through the whole
  day that is retention_days later, then expires at local midnight. So every send
  on the same day dies together, and a guest always keeps the full final day.

  All current operators run on the US Pacific coast, so until per operator time
  zones exist, Pacific is the app default. Pacific observes daylight saving, so
  the UTC offset is derived per instant with Intl, never hardcoded.
*/
export const OPERATOR_TZ = "America/Los_Angeles";

// The calendar year, month, day that an instant falls on in a given time zone.
function zonedYmd(
  instant: Date,
  timeZone: string,
): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

// Milliseconds that local wall clock time leads UTC in a zone at an instant
// (negative for the Americas). Derived from Intl so daylight saving is exact.
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

// The UTC instant of local midnight (00:00) on a given calendar day in a zone.
function zonedMidnightUtc(
  y: number,
  m: number,
  d: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Correct the guess by the zone offset, re-deriving once in case the first
  // guess landed on the far side of a daylight saving change. US transitions
  // happen at 02:00 local, so local midnight is always well defined.
  const offset = tzOffsetMs(new Date(guess), timeZone);
  let result = guess - offset;
  const offset2 = tzOffsetMs(new Date(result), timeZone);
  if (offset2 !== offset) result = guess - offset2;
  return new Date(result);
}

// The UTC instant (ISO) of the start of the local calendar day that `instant`
// falls on, in the given zone. For "today" windows like the admin QR sign-ups
// counter, which should track the operator's day, not a UTC day that rolls over
// mid-afternoon on the Pacific coast. DST-safe via the same Intl logic.
export function startOfLocalDayUtc(
  instant: Date = new Date(),
  timeZone: string = OPERATOR_TZ,
): string {
  const { y, m, d } = zonedYmd(instant, timeZone);
  return zonedMidnightUtc(y, m, d, timeZone).toISOString();
}

// The moment a send made at sentAt should expire: local midnight after the last
// live day, which is retentionDays after the send's local day.
export function deliveryExpiresAt(
  sentAt: Date,
  retentionDays: number,
  timeZone: string = OPERATOR_TZ,
): string {
  const { y, m, d } = zonedYmd(sentAt, timeZone);
  // Last live day is retentionDays after the send day; it expires at the
  // following local midnight, so step one more day past it. Doing the day math
  // in UTC keeps it pure calendar arithmetic, with no daylight saving skew.
  const target = new Date(Date.UTC(y, m - 1, d + retentionDays + 1));
  return zonedMidnightUtc(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
    timeZone,
  ).toISOString();
}
