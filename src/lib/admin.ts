/*
  Platform admin gate. The admin screens (comp operators, etc.) are for the
  Flukesend owner, not for operators. Access is by the signed in user's email
  against an allowlist. ADMIN_EMAILS (comma separated) overrides the default.
  Non admins get a 404 so the page does not reveal itself. No em dashes.
*/
import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS ?? "flukesend@gmail.com,enoceantours@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// Bounces non admins with a 404. Returns the admin user when allowed.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    notFound();
  }
  return user!;
}
