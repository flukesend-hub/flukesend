@AGENTS.md

# Flukesend

Standalone web product: branded photo delivery plus an automatic review engine
for whale watch operators. Think WeTransfer, but the download triggers a branded
review ask.

The product is live in production (https://www.flukesend.com) with three real
operators on it. Read docs/state.md first: it is the current product state, the
decisions already made, and the idea backlog. The README covers how the code
works. docs/spec.md is the kickoff spec and has drifted; do not treat it as
current.

## Standing constraints
- No em dashes in any copy or code comments. Anywhere.
- Build step by step, one step at a time, stop for confirmation between steps.
- Separate product from Trip Logger. Do not import or reference its code or data.
- Operator is always the tenant. Multi tenant from day one, RLS by operator.
- The Supabase service role key is server only and must never reach the client.
- Production has live customers and daily guest traffic. Be careful with data
  fixes, and never touch the current day's captures without asking.

## Stack
- Next.js (App Router, TypeScript) on Vercel, Pro plan, auto deploy on main.
- Supabase for Auth, Postgres, and Storage. Project ref ockpylhphwhumgulhvzv.
- Supabase Storage for photos in v1. Keep the storage_key abstraction so an R2
  swap later stays contained.
- Resend for transactional email, white labeled per operator.
- Stripe for the one paid plan ($300 a month, $3,000 a year).

## Supabase clients
- src/lib/supabase/browser.ts: browser client, anon key, RLS enforced.
- src/lib/supabase/server.ts: SSR client on request cookies, anon key, RLS.
- src/lib/supabase/admin.ts: server client, service role key, bypasses RLS.

## Ship loop
Edit, commit, push the working branch, wait for the Vercel preview build to go
READY (that is the compile check; local node_modules are not installed), open a
PR, merge to main, confirm the production deploy is READY, then tell the user.
SQL schema changes also get a numbered migration file in docs/.
