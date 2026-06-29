/*
  Browser side Supabase client. Uses the public anon key, which is safe to ship
  to the client because row level security gates every table by operator. Call
  this from client components only.
*/
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
