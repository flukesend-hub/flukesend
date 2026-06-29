/*
  Session refresh and route gate for the proxy (Next 16's renamed middleware).
  Runs on every matched request: it reads the Supabase auth cookies, refreshes
  the session when needed, and writes the updated cookies back onto the response
  so the browser stays in sync. It also redirects signed out visitors to /login.

  Keep this lean. The proxy runs on every route, including prefetches, so it
  does cookie work plus a single getUser call and nothing heavier.
*/
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths a signed out visitor may see. Everything else bounces to /login. The
// tokened guest gallery (/g/<token>, plus its download and open routes) is
// public: guests have no operator session and reach it only by their token.
// The cron endpoint is public to the proxy but guards itself with CRON_SECRET.
const PUBLIC_PATHS = ["/login", "/g", "/api/cron"];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not put any logic between createServerClient and getUser. Supabase needs
  // these adjacent so the refresh and the cookie write stay atomic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/send";
    return NextResponse.redirect(url);
  }

  return response;
}
