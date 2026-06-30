/*
  The lifecycle status of one guest on a send, derived from their review email
  status and their tracked events. Shared by the Send created page and the
  Transfers drawer so the labels never drift. No em dashes anywhere.

  Order of precedence: a sent review ask is the final state; before that, a
  download (the trigger) outranks an open, which outranks nothing yet.
*/
export type RecipientStatus = "review_sent" | "downloaded" | "opened" | "sent";

export function recipientStatus(
  reviewEmailStatus: string | null,
  hasDownload: boolean,
  hasOpen: boolean,
): RecipientStatus {
  if (reviewEmailStatus === "sent") return "review_sent";
  if (hasDownload) return "downloaded";
  if (hasOpen) return "opened";
  return "sent";
}

export const STATUS_META: Record<
  RecipientStatus,
  { label: string; tone: "good" | "info" | "muted" }
> = {
  review_sent: { label: "Review sent", tone: "good" },
  downloaded: { label: "Downloaded", tone: "info" },
  opened: { label: "Opened", tone: "muted" },
  sent: { label: "Sent", tone: "muted" },
};
