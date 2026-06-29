@AGENTS.md

# Flukesend

Standalone web product: branded photo delivery plus an automatic review and tip
engine for whale watch operators. Think WeTransfer, but the download triggers a
branded review ask. Source of truth is docs/spec.md. Visual reference is
docs/mockup.html. Database schema is docs/0001_init.sql.

## Standing constraints
- No em dashes in any copy or code comments. Anywhere.
- Build step by step, one step at a time, stop for confirmation between steps.
- Separate product from Trip Logger. Do not import or reference its code or data.
- Operator is always the tenant. Multi tenant from day one, RLS by operator.
- The Supabase service role key is server only and must never reach the client.

## Stack
- Next.js (App Router, TypeScript) on Vercel.
- Supabase for Auth, Postgres, and Storage. Project ref ockpylhphwhumgulhvzv.
- Supabase Storage for photos in v1. Keep the storage_key abstraction so an R2
  swap later stays contained.
- Resend for transactional email, wired only after the domain is verified.

## Supabase clients
- src/lib/supabase/browser.ts: browser client, anon key, RLS enforced.
- src/lib/supabase/admin.ts: server client, service role key, bypasses RLS.

## Build order
- Session 1: scaffold (done), auth plus operator setup screen, the send flow.
- Session 2: guest gallery, download event, nightly review email.
- Later: tip jar (Stripe Connect), FareHarbor webhook, capture rate stats.
