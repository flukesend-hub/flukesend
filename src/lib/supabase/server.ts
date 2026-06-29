/*
  Server side Supabase client bound to the current request cookies. It uses the
  public anon key, so row level security still applies: every query runs as the
  signed in operator member and sees only that operator's rows.

  Use this in Server Components, Server Actions, and Route Handlers. For trusted
  work that must bypass RLS (onboarding writes, the guest gallery, the nightly
  review job) use createAdminClient from admin.ts instead.

  cookies() is async in Next 16, so this factory is async too. Await it.
*/
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Setting cookies is not allowed during Server Component render.
            // Safe to ignore here: the proxy refreshes the session cookie on
            // every request, so write paths (actions, route handlers) are the
            // ones that actually need to persist it.
          }
        },
      },
    },
  );
}
