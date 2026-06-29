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
// tokened guest gallery (server rendered, no operator session) gets added here
// in Session 2 once it exists.
const PUBLIC_PATHS = ["/login"];

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
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
