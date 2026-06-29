/*
  Server side Supabase client with the service role key. This key bypasses row
  level security, so it is for trusted server code only: onboarding, the guest
  gallery reads, and the nightly review job. It must never reach the browser.

  The key is read from SUPABASE_SERVICE_ROLE_KEY, which has no NEXT_PUBLIC
  prefix and so is never bundled into client code. The window guard below is a
  second line of defense.
*/
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only be called on the server.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
