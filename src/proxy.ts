/*
  Proxy is what Next 16 calls the file that used to be middleware.ts. It lives
  beside app/ (so at src/proxy.ts) and runs before requests are completed. Here
  it does one job: keep the Supabase session fresh and gate the app behind auth.
  The real work is in lib/supabase/proxy.ts.
*/
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on every path except Next internals and static image files. Auth wants
  // the proxy on as many routes as possible so session refresh is universal.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
