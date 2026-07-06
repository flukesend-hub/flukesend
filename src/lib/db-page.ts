/*
  Paged reads. PostgREST caps every response at a fixed maximum (1000 rows on
  this project) and .limit() cannot raise it, so any query whose result can grow
  past 1000 rows must page with .range() or it silently truncates. That
  truncation quietly undercounts the funnel, the numbers the product is judged
  and sold on, so every analytics read that can grow pages through here.
*/
import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// Loose data type: the Supabase generated types shape an embedded to-one join
// as an array, while at runtime a !inner join returns an object, so callers
// cast the row to their own shape (as the rest of the codebase already does).
// The row count is all fetchAllRows itself cares about.
type PageResult = { data: unknown[] | null; error: PostgrestError | null };

// Walk .range() windows until a short page signals the end. makeQuery must
// apply .range(from, to) to a query that is otherwise fully built (selects,
// filters, order). Callers should .order() by a unique column so a row never
// lands on two pages.
export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await makeQuery(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export type EventRow = { recipient_id: string; type: string };

// Every event for a set of recipients, paged. Recipients are chunked so the IN
// list stays a sane size, and each chunk is itself paged past the 1000 cap. A
// single busy operator can carry well over 1000 event rows in a chunk because
// each photo download writes its own event.
export async function loadEventsForRecipients(
  client: SupabaseClient,
  recipientIds: string[],
  recipientChunk = 300,
): Promise<EventRow[]> {
  const out: EventRow[] = [];
  for (let i = 0; i < recipientIds.length; i += recipientChunk) {
    const chunk = recipientIds.slice(i, i + recipientChunk);
    const rows = await fetchAllRows<EventRow>((from, to) =>
      client
        .from("events")
        .select("recipient_id, type")
        .in("recipient_id", chunk)
        .order("recipient_id")
        .range(from, to),
    );
    out.push(...rows);
  }
  return out;
}
