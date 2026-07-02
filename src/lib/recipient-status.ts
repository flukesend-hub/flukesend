/*
  The lifecycle status of one guest on a send, derived from their review email
  status, their tracked events, and what Resend reported about the email
  itself. Shared by the Send created page and the Transfers drawer so the
  labels never drift. No em dashes anywhere.

  Order of precedence: a sent review ask is the final state; before that, a
  download (the trigger) outranks an open. A guest with no activity shows
  what happened to their email instead: bounced and marked-spam are loud (the
  address needs fixing), delivered is a quiet confirmation, and plain sent
  means Resend has not reported back yet.
*/
export type RecipientStatus =
  | "review_sent"
  | "downloaded"
  | "opened"
  | "bounced"
  | "complained"
  | "delivered"
  | "sent";

export function recipientStatus(
  reviewEmailStatus: string | null,
  hasDownload: boolean,
  hasOpen: boolean,
  emailStatus?: string | null,
): RecipientStatus {
  if (reviewEmailStatus === "sent") return "review_sent";
  if (hasDownload) return "downloaded";
  if (hasOpen) return "opened";
  if (emailStatus === "bounced") return "bounced";
  if (emailStatus === "complained") return "complained";
  if (emailStatus === "delivered") return "delivered";
  return "sent";
}

export const STATUS_META: Record<
  RecipientStatus,
  { label: string; tone: "good" | "info" | "muted" | "bad" }
> = {
  review_sent: { label: "Review sent", tone: "good" },
  downloaded: { label: "Downloaded", tone: "info" },
  opened: { label: "Opened", tone: "muted" },
  bounced: { label: "Bounced, fix the address", tone: "bad" },
  complained: { label: "Marked as spam", tone: "bad" },
  delivered: { label: "Delivered", tone: "muted" },
  sent: { label: "Sent", tone: "muted" },
};
