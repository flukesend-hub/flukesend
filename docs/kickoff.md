# Claude Code kickoff prompt

Paste everything below the line into Claude Code as your first message, in an
empty folder where you want the repo to live. Have `afterglow_spec.md`,
`afterglow_mockup.html`, and `0001_init.sql` in that folder first so Claude Code
can read them.

---

You are building a standalone web product from scratch. Read `afterglow_spec.md`
in this folder first. It is the source of truth. `afterglow_mockup.html` is the
clickable visual reference for the four screens. `0001_init.sql` is the database
schema, already written, use it as is.

Standing constraints, follow all of them:
- No em dashes in any copy or code comments. Anywhere.
- Build and execute step by step, one step at a time. Stop and let me confirm
  after each step before moving on. Do not scaffold the whole app at once.
- This is a separate product from Trip Logger. Fresh repo, fresh Supabase
  project, its own auth. Do not import or reference any Trip Logger code or data.
- Operator is always the tenant. Multi tenant from day one, RLS by operator,
  as the migration already enforces.

Stack, per the spec section 6:
- Next.js (App Router) deployed on Vercel. Auth, the upload and send server
  routes, the token based gallery page, and the nightly review email cron all
  live in this one deployable unit.
- Supabase for Auth, Postgres, and Storage. I have already created the project
  and run `0001_init.sql`. I will give you the project URL and keys for
  `.env.local`.
- Supabase Storage for photos in v1, not R2. Keep the `storage_key` abstraction
  from the schema so swapping to Cloudflare R2 later is contained.
- Resend for transactional email, with SPF, DKIM, and DMARC on a verified
  domain. Do not wire real sends until I confirm the domain is verified.

Guest galleries and the nightly review job read across operators, so they must
run server side with the Supabase service role key, which bypasses RLS. The
service role key is server only and must never reach the client.

Build order for this session, from spec section 7, Session 1. Do these in order,
one at a time, pausing for my confirmation between each:

1. Initialize the Next.js repo and a clean project structure. Set up the
   Supabase client helpers (a browser client with the anon key, a server client
   with the service role key) and a `.env.local.example`. Confirm it builds and
   runs locally. Stop.
2. Auth plus the operator setup screen: log in or sign up, and on first sign in
   create the operator, its branding row, and the owner membership row server
   side with the service role. Then the setup form saves logo, brand color,
   default message, the review destination links, and retention days (3 to 10,
   with the paid plan note). Match the dark workspace look from screen 1 of the
   mockup. Stop.
3. The send flow, the heart of the product, give it the most time: the trip
   detail form, photo upload to Supabase Storage, and the email paste box that
   parses messy pasted text into individual recipient rows, each with its own
   token. The parser logic already works in the mockup script, port that
   behavior. On send, write one delivery, its photos, and one recipient row per
   valid email, and stamp `expires_at` from the operator's retention days.

End this session with one real working send that writes real rows, not four half
finished screens. Do not build the guest gallery, the download event, or the
review email yet. That is Session 2.

Before you start, confirm you have read the spec and the migration, then tell me
step 1's plan and wait for my go ahead.
