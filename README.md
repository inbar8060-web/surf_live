# Surfer Live

Booking and inventory for a surf club or retreat centre. Three roles — **member**,
**instructor**, **administrator** — on Next.js 16, Supabase (Postgres + Auth + RLS)
and a pluggable payment provider, ready to deploy on Vercel.

---

## What each role can do

**Member**
- See the sea and wind at the club's spot before deciding to come down
- Request a place on a session; pay per session or spend a lesson from a package
- Change or cancel an approved booking — a change automatically sends it back for re-approval
- Message their instructor on WhatsApp, or open the session's group chat, in one tap
- Review the session on a public wall every member can scroll
- Send private feedback about an instructor, readable by management only
- Tip an instructor from the app
- Change their own password. Personal details are held by the club and are not self-editable

**Instructor**
- Today's roster with each member's phone, level, medical notes and emergency contact
- Approve or decline requests, but only for sessions they are assigned to
- View every group in the club, read only
- Export the day's schedule as CSV, including client details
- Open the session's WhatsApp group, or call any member, in one click

**Administrator**
- Categories, services, sessions, instructors, and which instructor is on which session
- Approve or decline any request; block, reopen or cancel a session
- Full inventory: gear types, stock levels, per-unit condition and status
- Rentals — a board leaves stock on hand-over and returns when booked back in
- Change any price; every change is recorded automatically
- Register a member at the desk, or issue a single-use registration link
- Attach a lesson package to a member, extend it, or dismiss what is left
- Edit every detail of every account
- Read private instructor feedback and moderate the public review wall

---

## Getting it running

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Fill in `.env.local`

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | same page — **server only, never expose** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, your domain in production |
| `APP_SECRET` | `openssl rand -base64 48` |
| `PAYMENT_PROVIDER` | `mock` while developing, `stripe` in production |

The app validates its environment at boot and refuses to start on a missing or
malformed value, rather than failing later with a confusing 500.

### 3. Create the database

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then load the sample catalog and starting stock:

```bash
npx supabase db execute --file supabase/seed.sql
```

### 4. Create the first accounts

```bash
npm run seed:users
```

This refuses to run against anything that does not look like a local or staging
project. Change every seeded password immediately.

### 5. Start

```bash
npm run dev
```

---

## Deploying

### Supabase
1. `npx supabase db push` against the production project.
2. Under **Authentication → Providers → Email**, turn **signup off**. Accounts are
   only created by an administrator or through an invite link, and the app assumes
   that. Leaving public signup on would let anyone create an account.
3. Set the site URL and add `https://your-domain/auth/callback` to the redirect list.

### Vercel
1. Import the repository.
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_SECRET`, `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` must **not** be prefixed `NEXT_PUBLIC_`.
3. Set `NEXT_PUBLIC_SITE_URL` to the production domain — invite links and payment
   return URLs are built from it.

### Payments
The app talks to `PaymentProvider` (`src/lib/payments/provider.ts`), not to Stripe
directly. Swapping in a local acquirer — Tranzila, Cardcom, PayPlus — means writing
one file next to `stripe.ts` and changing `PAYMENT_PROVIDER`; no call site moves.

For Stripe:
1. Add a webhook endpoint at `https://your-domain/api/webhooks/payments`.
2. Subscribe to `checkout.session.completed`, `checkout.session.expired`,
   `payment_intent.payment_failed` and `charge.refunded`.
3. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.

A payment is only ever marked paid by a signature-verified webhook whose amount
matches the invoice. The browser's return trip is treated as a navigation hint,
never as proof of payment.

---

## Running the database tests

```bash
npm run test:db
```

Applies every migration to a throwaway Postgres in Docker and runs the SQL
suite in `supabase/tests` — 76 assertions covering the parts that would be
expensive to get wrong:

- accounts, roles and what each role can and cannot read
- pricing, capacity, re-approval and who may decide a booking
- lesson package credits, extension and dismissal
- inventory levels, rentals and the return path
- review confidentiality, invites, price history and scheduling guards

Each test acts as a real role by setting the JWT subject claim and switching to
`authenticated`, which is what PostgREST does per request — so the assertions
exercise the actual RLS policies rather than a stand-in for them.

The container is a plain Postgres with `scripts/pg-bootstrap.sql` supplying the
handful of Supabase platform objects the schema depends on (`auth.users`,
`auth.uid()`, the three API roles).

## How the security model works

Authorization is enforced **three times**, deliberately.

**1. In the database (the one that actually holds).**
Every table has RLS enabled, privileges are revoked wholesale and granted back
per verb. Business rules that matter live in triggers, so they hold
no matter which client writes:

- a booking's **price is computed by a trigger** from the session and service —
  the browser cannot influence what a booking costs;
- **capacity is checked under a row lock** on the session, so two simultaneous
  bookings cannot oversell the last place;
- a member editing an approved booking is **forced back to `pending`**;
- the same physical board **cannot be double-booked** (a `gist` exclusion constraint);
- lesson credits move only through an **append-only ledger**;
- `audit_log`, `price_history` and `package_ledger` **reject UPDATE and DELETE**.

**2. In server code.** Each area's layout calls `requireRole()` before rendering,
and every Server Action re-checks the caller — a layout guard protects the page,
not the action behind it.

**3. In the proxy layer.** Session refresh and an anonymous-visitor bounce only.
Role checks are not made here: an edge check without a database round trip would
be advisory, and the two layers above already hold.

Other deliberate choices:

- **Two Supabase clients.** `createUserClient()` carries the user's JWT and is
  subject to RLS — it is the default. `createAdminClient()` bypasses RLS and is
  only used behind a role guard, for reading protected columns, creating auth
  users, or handling webhooks where there is no session at all. `grep -rn
  createAdminClient src` audits every use.
- **`getUser()`, never `getSession()`.** `getSession` only decodes the cookie;
  `getUser` revalidates the token with the auth server.
- **Roles live in `app_metadata`**, which only the service role can write. A user
  cannot promote themselves by editing their own metadata.
- **Invite links are single-use and stored only as a SHA-256.** The raw token is
  shown to the administrator once. A database leak yields no usable links, and
  redemption is a conditional write, so two people racing the same link cannot
  both get an account.
- **Column-level grants** keep `clients.admin_notes`,
  `instructors.payout_account_ref` and `reservations.staff_note` unreadable by any
  browser session, including an administrator's. These columns are never granted
  in the first place — a table-wide `GRANT SELECT` followed by a column-level
  `REVOKE` does **not** work in Postgres, the table grant keeps permitting every
  column and the revoke silently achieves nothing. The consequence for queries is
  that `select('*')` cannot be used against those tables with a user session;
  `src/lib/db/columns.ts` holds the explicit lists.
- **Private instructor feedback is invisible to the instructor** by RLS policy,
  not merely by not being rendered.
- **Views project, tables do not.** Members are given no direct read on
  `time_slots`; they read `slot_catalog` and `my_bookings`, which expose only the
  columns they may see. Staff notes and block reasons never reach a member's browser.
- **Money is integer minor units** everywhere. No float ever touches an amount.
- **CSV exports are formula-escaped**, so an exported note starting `=` cannot
  execute when the file is opened in a spreadsheet.
- **Redirects are path-only.** `?next=` accepts `/path` and nothing else, so it
  cannot become an open redirect.
- **Login is rate limited** per account and per source address, and failures never
  reveal whether an email exists.
- A **strict CSP** with no `unsafe-eval` and no inline scripts, plus HSTS,
  `frame-ancestors 'none'` and a locked-down `Permissions-Policy`.

---

## Layout

```
supabase/migrations/   schema, RLS policies, triggers, views, RPC
  0001 … 0005          tables and constraints
  0006                 business rules as triggers
  0007                 row level security
  0008                 read models (views)
  0009                 callable operations

src/lib/
  supabase/            the two clients — user (RLS) and admin (service role)
  auth/session.ts      requireRole / assertRole guards
  actions/             one module per domain, all validated and audited
  validation/          Zod schemas for every input
  payments/            provider interface + Stripe and mock implementations
  surf/                Open-Meteo marine and wind forecast
  util/                money, dates, phone links, rate limiting, invite tokens

src/app/
  admin/ instructor/ client/    the three areas, each guarded in its layout
  api/webhooks/payments/        the only route that can mark a payment paid
```

---

## Known limitations

- **Tested against plain Postgres 15, not against Supabase itself.** The
  migrations apply cleanly and all 76 assertions pass, but the harness stubs the
  platform objects. GoTrue's own behaviour (email confirmation, password reset,
  session timeboxing) and PostgREST's request handling are not covered. Push to a
  scratch Supabase project and walk the flows once before going live.
- **The rate limiter is in-process.** On Vercel each instance keeps its own
  counter, which raises the cost of an attack without being a hard ceiling. Swap
  `store` in `src/lib/util/rate-limit.ts` for Upstash Redis before relying on it;
  the interface is the only thing call sites depend on.
- **The tests cover the database, not the UI.** There is no browser-level test
  of the Server Actions or the React screens; the SQL suite is what stands
  between a policy change and a data leak.
- **Database types are hand-maintained.** Once a project is linked, replace
  `src/lib/db/types.ts` with `npx supabase gen types typescript --local`. Keep
  them as `type` aliases, not `interface` — see the note at the top of that file.
- Email delivery (booking confirmations, password reset) is not wired up; Supabase
  Auth handles password reset out of the box once SMTP is configured.
