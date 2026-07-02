/*
  Resend delivery webhook. Resend calls this with what happened to each email
  after we handed it off: delivered, bounced, or complained (marked as spam).
  The event carries the email id we stored on the recipient at send time, so
  the status lands back on the right guest row and the operator can see a bad
  address instead of wondering why a guest never opened.

  Signature: Resend signs webhooks in the Svix format. The signed content is
  "{svix-id}.{svix-timestamp}.{raw body}", HMAC SHA-256 with the base64
  webhook secret, compared against the space separated candidates in the
  svix-signature header. Verified by hand here; a dependency is not worth
  three headers and one HMAC. Replays older than five minutes are rejected.

  Always answers 200 for verified events it does not track, so Resend does
  not retry-storm over event types we ignore.
*/
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const TOLERANCE_SECONDS = 300;

// email.delivered arriving after a bounce (out of order, or a later message
// to the same guest) must never hide the bounce: bounce and complaint are
// sticky, delivered only fills empty or refreshes delivered.
const STICKY = new Set(["bounced", "complained"]);

const EVENT_STATUS: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

function verifySignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): boolean {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();
  for (const candidate of signatureHeader.split(" ")) {
    const [version, sig] = candidate.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      return true;
    }
  }
  return false;
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 503 });
  }

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return new Response("Missing signature headers", { status: 401 });
  }
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return new Response("Timestamp out of tolerance", { status: 401 });
  }
  const body = await request.text();
  if (!verifySignature(secret, id, timestamp, body, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const status = EVENT_STATUS[event.type ?? ""];
  const emailId = event.data?.email_id;
  if (!status || !emailId) {
    return new Response(null, { status: 200 });
  }

  const admin = createAdminClient();
  const { data: recipient, error: findErr } = await admin
    .from("recipients")
    .select("id, email_status")
    .eq("resend_email_id", emailId)
    .maybeSingle();
  if (findErr) {
    console.error(`resend webhook: recipient lookup failed for ${emailId}: ${findErr.message}`);
    return new Response("Lookup failed", { status: 500 });
  }
  if (!recipient) {
    // An email we did not track (or a recipient since deleted). Fine.
    return new Response(null, { status: 200 });
  }
  if (STICKY.has(recipient.email_status as string) && !STICKY.has(status)) {
    return new Response(null, { status: 200 });
  }

  const { error: upErr } = await admin
    .from("recipients")
    .update({ email_status: status, email_status_at: new Date().toISOString() })
    .eq("id", recipient.id);
  if (upErr) {
    console.error(`resend webhook: status update failed for ${recipient.id}: ${upErr.message}`);
    return new Response("Update failed", { status: 500 });
  }
  return new Response(null, { status: 200 });
}
