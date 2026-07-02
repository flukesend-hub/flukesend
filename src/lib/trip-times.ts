/*
  Trip time slots. Whale watch boats leave on the hour or the half hour, so a
  trip is picked from fixed 30 minute slots rather than a free time field. Shared
  by the guest capture form and the send form so a guest's "9:00 AM" lines up
  exactly with what the operator selects later. Plain module, safe on the client.
*/

// 6:00 AM through 8:00 PM in 30 minute steps, as "HH:MM" 24 hour keys.
export const TRIP_TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 20; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 20) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

export function isTripTime(value: string): boolean {
  return TRIP_TIME_SLOTS.includes(value);
}

// The trip times to show on the send form and the guest QR form. An operator
// picks their real departure times in Settings; until they do (empty list) we
// fall back to every slot so nothing is ever missing. Always returned valid
// and in chronological order.
export function tripTimesFor(configured: string[] | null | undefined): string[] {
  const clean = (configured ?? []).filter((t) => TRIP_TIME_SLOTS.includes(t));
  if (!clean.length) return TRIP_TIME_SLOTS;
  return TRIP_TIME_SLOTS.filter((slot) => clean.includes(slot));
}

// "09:30" becomes "9:30 AM".
export function formatTripTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
