/*
  Auth callback. Supabase redirects here after a password reset link (and later,
  Google sign in) with a one-time code. We exchange it for a session cookie and
  send the user on to `next` (the reset-password page for recovery). The code
  verifier cookie was set in the same browser when the reset was requested, so
  the link must be opened in that browser. No em dashes anywhere.
*/
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Only relative paths: "next" rides in from the email link, and anything
  // like "//evil.com" or ".evil.com" would turn this redirect into a phishing
  // hop right after a successful password reset.
  const nextRaw = url.searchParams.get("next") ?? "/send";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\")
    ? nextRaw
    : "/send";
  // Prefer the forwarded host so redirects land on the public domain, not an
  // internal Vercel URL.
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const origin = `${proto}://${host}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
