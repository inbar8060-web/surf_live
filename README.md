# Surfer Live

Booking and inventory for surf clubs and retreat centres. One deployment serves
many clubs, each at its own subdomain with its own data. Three roles inside a
club — **member**, **instructor**, **administrator** — plus a **platform
operator** who runs the clubs without seeing inside them. Next.js 16, Supabase
(Postgres + Auth + RLS) and a pluggable payment provider, ready for Vercel.

---

## Three interfaces, one codebase

The three roles no longer share a responsive web shell. Each area is built for
how it is actually used:

| Area | Shape | Palette | Type |
| --- | --- | --- | --- |
| Member (`/client`) | Phone app, bottom tab bar with a raised booking action | Deep water — sea ramp on `#072f49` | Outfit + Nunito Sans |
| Instructor (`/instructor`) | Phone app, one thing at a time, readable in sunlight | Warm grey, a single accent | Manrope |
| Admin (`/admin`) | Desktop **and** phone, seven named categories | Dark green chrome on paper | Manrope |

Fonts are self-hosted through `next/font`, so there is no request to Google at
runtime and nothing to add to the CSP. The tokens for all three live in one
`@theme` block in `src/app/globals.css`.

The ten admin routes are grouped into seven categories, with sub-tabs in the
URL (`?tab=`) so a screen can be linked and bookmarked:

| Category | Sub-tabs |
| --- | --- |
| Desk | — |
| Bookings | Awaiting approval · Approved · Closed |
| Schedule | day strip |
| Catalog | Services & prices · Categories · Lesson packages · Price history |
| People | Directory · Instructors · Open invites · Reviews & feedback |
| Gear | Out and reserved · Gear types · Every unit · Rental history |
| Club | Settings · Public reviews · Audit log |

The old paths (`/admin/requests`, `/admin/inventory`, `/admin/rentals`,
`/admin/packages`, `/admin/settings`, `/admin/reviews`) permanently redirect
into the category that now holds them.

Every control that changes club data carries a help affordance: a 15px icon
that opens on hover **and** on keyboard focus, anchored below so it never
covers the row it explains. Where the consequence really matters it is written
as inline helper text as well, because a tooltip can always be missed.

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
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | the domain clubs live under: `localhost:3000` locally, `surferlive.app` in production — see *Many clubs, one deployment* |
| `NEXT_PUBLIC_DEV_CLUB_SLUG` | development only: the club a bare `localhost:3000` or LAN address opens, so a phone on the Wi-Fi can test the app |
| `APP_SECRET` | `openssl rand -base64 48` |
| `PAYMENT_PROVIDER` | `mock` while developing, `stripe` in production |
| `GOOGLE_MAPS_API_KEY` | optional — reads a club's listing (address, hours, contact, pin) from its Maps link when a club is added |
| `ANTHROPIC_API_KEY` | optional — turns on the support assistant. Without it the support screen is a plain thread to the platform |
| `MAIL_PROVIDER` / `MAIL_FROM` | `log` is the only provider so far (prints, never sends); see *Email* |

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

Locally every club is a subdomain of `localhost:3000`, which browsers resolve
without any DNS setup:

| Address | What it is |
| --- | --- |
| `http://surfer-live.localhost:3000` | the seeded club — members, instructors, administrator |
| `http://admin.localhost:3000` | the platform operator (`ops@surferlive.test`) |
| `http://localhost:3000` | the platform's front door, which names no club |

`seed:users` creates `ops@surferlive.test` as the operator alongside the club's
own accounts. A club created from the operator's screen gets its own address,
`<slug>.localhost:3000`, straight away.

---

## Many clubs, one deployment

The platform is handed to several clubs at once. What keeps them apart:

**The address.** `<slug>.<NEXT_PUBLIC_PLATFORM_DOMAIN>` is a club;
`admin.<domain>` is the operator; the bare domain is the front door. The
subdomain is parsed once, in `src/proxy.ts`, and passed down as a header. It
decides which club a *visitor* is looking at — never which club a *signed-in
person* belongs to. That is fixed on their profile, and the two are compared in
every club layout (`requireClubRole`): a member of club A who opens club B's
address is sent home to A, not shown B.

**The rows.** Every club-scoped table carries `club_id NOT NULL`. Every RLS
policy is conjoined with `club_id = app.current_club_id()`, which reads the
caller's club from their profile — not from a JWT claim, not from the URL.
Foreign keys between club tables are composite `(club_id, id)`, so a booking
cannot reference a session in another club even from service-role code. A
`_00_set_club` trigger on every table fills the club from the caller, refuses a
row that names a different one, and refuses a server-side insert that names
none — there is no default club, anywhere. `club_id` is frozen after insert.

**The operator.** `super_admin` is a fourth role with no club, so not one policy
written for administrators applies to it. It has no policy on any club table at
all: it reads `clubs`, two aggregate views (`club_statistics`, `club_activity` —
counts only, no money, no names), the support tables and its own audit log. The
suite in `supabase/tests/06_tenant_isolation.sql` proves each of these, and
fails the build if a future table or policy forgets the club.

**Adding a club.** From `admin.<domain>/platform/clubs/new`: paste the club's
Google Maps link and press *Look up*. The listing supplies the name, street
address, opening hours, phone, website and the exact pin (which is where the
surf forecast is read from), and the Time Zone API supplies the club's clock;
the operator checks the details, corrects anything, adds the administrator's
email and creates the club. Short links (`maps.app.goo.gl`) are followed, but
only to Google's own hosts. Reading the listing needs `GOOGLE_MAPS_API_KEY`
(Places API (New) + Time Zone API enabled); without it the app reads what the
link itself says — name and pin — and the rest is typed in. The club can
correct all of it later under *Club → Settings*, and the operator can re-read
the listing from the club's page. `provision_club()` creates the club, its
settings row and the audit line in one transaction; the app mints a
single-use registration link bound to that club and emails it. The account
that link creates belongs to that club and no other. Clubs can be paused (members
see a holding page, administrators can still sign in), resumed, or archived
(offline, data kept; anyone still signed in is shown `/closed`). Nothing is ever deleted from the operator's screens.

**Plans, billing and payouts.** A club's administrator, once their account
exists, is walked through two steps before the desk opens: choose a plan and
pay for it, then connect the club's own payout account. The three plans live
in the `plans` table — Beach Vibes ($150/mo: 10 instructors, 100 new members
and 100 payments a month, monthly report), Ocean Vibes ($275/mo: 25, 220,
300, monthly/quarterly/yearly reports and the payments ledger) and Surfing
Vibes ($550/mo: unlimited, full finance dashboard and export). The limits are
enforced by database triggers, not screens: the eleventh instructor on Beach
Vibes is refused with the plan named, and so is the hundred-and-first payment
in a month. Member payments are charged on the club's *own* connected account
(Stripe Connect Express; Apple Pay, Google Pay and Link come with hosted
Checkout) with the platform's share taken as an application fee at the rate
the operator sets per club. Nothing becomes paid, active or connected except
from a signature-verified webhook; the `mock` provider stands in for all
three flows in development.

**Legal documents.** Terms of Service, Privacy Policy, Club Service Agreement
and Instructor Agreement live in `src/lib/legal`, versioned like the signing
documents, and are public at `/legal/<key>`. An administrator accepts theirs
with the box on the registration form; members (after the club's waiver and
rental agreement) and instructors accept theirs on first sign-in. What is
recorded is who, which document, which version, when — never the text.

**Finance.** `/admin/finance` is the club's money by month, quarter or year
(as the plan allows): taken online, net after refunds and fees, booked value,
what sells, the payments ledger, tips per instructor, CSV export.
`/platform/finance` is the operator's: MRR by plan, each club's billing and
payout status and fee rate, and monthly volume per club from
`platform_club_finance` — sums and counts only, never a payment row or a
member.

**Support.** A club administrator opens `/admin/support`. With
`ANTHROPIC_API_KEY` set, the assistant (Claude, `src/lib/support/assistant.ts`)
asks the questions a support engineer would and writes a structured report;
the administrator can hand over to a person at any point. Without the key, the
conversation goes straight to the operator. The operator reads and replies at
`/platform/support`. The assistant is given the club's name and the
administrator's words — nothing from the club's tables — so the report is free
of member data by construction.

---

## Deploying

### Supabase
1. `npx supabase db push` against the production project.
2. Turn off open registration under **Authentication → Sign In / Providers →
   *Allow new users to sign up***. Accounts are only created by an administrator
   or through an invite link, and the app assumes that.

   Leave the **Email** provider itself **enabled**. Disabling the email provider
   turns off password *logins* too, not just registration, and locks every
   existing user out — the local equivalent is `[auth.email] enable_signup`, which
   `supabase/config.toml` deliberately keeps `true`.
3. Set the site URL and add `https://your-domain/auth/callback` to the redirect list.

### Vercel
1. Import the repository.
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_SECRET`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` and `GOOGLE_MAPS_API_KEY` must **not** be prefixed
   `NEXT_PUBLIC_`.
3. Set `NEXT_PUBLIC_SITE_URL` to the production domain and
   `NEXT_PUBLIC_PLATFORM_DOMAIN` to the bare domain clubs live under (for example
   `surferlive.app`).
4. Add the domain **and a wildcard** to the project: `surferlive.app` and
   `*.surferlive.app`. At the DNS provider, point `@` and `*` at Vercel (a CNAME
   for `*` to `cname.vercel-dns.com`, or Vercel's nameservers). Vercel issues the
   wildcard certificate itself. Every club and the operator's `admin.` address
   then resolve without any per-club setup.

### Payments
The app talks to `PaymentProvider` (`src/lib/payments/provider.ts`), not to Stripe
directly. Swapping in a local acquirer — Tranzila, Cardcom, PayPlus — means writing
one file next to `stripe.ts` and changing `PAYMENT_PROVIDER`; no call site moves.

For Stripe (with Connect enabled on the platform account):
1. Add a webhook endpoint at `https://your-domain/api/webhooks/payments` for
   **your account's** events — `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed` — and put its secret in `STRIPE_WEBHOOK_SECRET`.
2. Add a second endpoint at the same URL, this time **"Listen to events on
   Connected accounts"** — `checkout.session.completed`,
   `checkout.session.expired`, `payment_intent.payment_failed`,
   `charge.refunded`, `account.updated` — and put its secret in
   `STRIPE_CONNECT_WEBHOOK_SECRET`.
3. Enable Apple Pay and Google Pay under Payment methods; hosted Checkout
   then offers them on every club's address without per-domain registration.

A payment is only ever marked paid by a signature-verified webhook whose amount
matches the invoice. The browser's return trip is treated as a navigation hint,
never as proof of payment.

---

## Signing at registration

A member cannot reach any part of the app until they have signed two documents:
the **waiver and release of liability** and the **boards rental agreement**.
The gate lives in `src/app/client/layout.tsx`, so it covers every member route
that exists now or is added later, rather than being repeated per page.

**The signed documents are never stored.** They are rendered to PDF in memory
at the moment of signing, emailed to the member and to the club, and dropped.
The member's inbox and the club's are the only copies that exist.

What *is* recorded, in `document_signatures`, is the signing event: who signed,
which document, which version of its wording, when, whether the email went out,
and a SHA-256 of the PDF that was sent. The digest is a one-way hash, not the
document — it exists so the club can later check that a copy someone produces
is the one that was signed. The record is immutable: the version, timestamp and
consent decision cannot be altered or deleted, and the digest is write-once.
Only delivery state may change, so a failed send can be retried.

`clients.media_consent` is the one form answer kept, because it is a standing
permission the club has to honour afterwards. The rest of the answers — the
board type — live only in the emailed copy.

### The documents

They are versioned TypeScript modules in `src/lib/documents/`, not database
rows and not uploaded files. Editing any wording means bumping `version`,
because the version string is the only record of what a member agreed to; a
member who signed an older version is asked to sign again.

The wording follows the club's reference forms. Two things to review before
this goes in front of real members:

- The rental agreement's damage schedule is carried over **verbatim, in US
  dollars**. Those are commercial terms, so they are left exactly as written
  rather than quietly converted.
- Media consent is deliberately **optional and never pre-ticked**. A member can
  decline it and still surf.

### Email

Delivery goes through the `MailProvider` seam in `src/lib/mail/`. Only the
development `log` provider exists so far — it records that a message would have
been sent, and deliberately writes the attachment nowhere. To add the real one:
write a module next to `log.ts` satisfying `MailProvider`, register it in
`index.ts`, and set `MAIL_PROVIDER`. Nothing else in the app changes.

The club's copy goes to `club_settings.contact_email`, or to every active
administrator when that is empty, so a signed waiver is never sent into a void.

A delivery failure never rolls the signature back — the member did sign, and
losing that because a mail host was down would be worse than a missing email.
The failure is recorded on the row for retry.

### Fonts

The PDFs embed Noto Sans Hebrew (SIL OFL, vendored under
`src/lib/documents/fonts/`) rather than a built-in PDF font. The standard PDF
fonts are WinAnsi-encoded and cannot draw anything outside Latin-1 — a member
called נעה would have had their own waiver print their name as `???`. A small
right-to-left pass puts Hebrew runs in visual order; it is not full bidi, which
is fine while the wording itself is English.

## Running the tests

```bash
npm test            # unit + database
npm run test:unit   # pure helpers, plain `node --test`, no framework
npm run test:db     # the SQL suite below
```

The unit suite covers the security helpers directly: the internal-path check,
client-address validation, the search sanitiser, database-error translation
and the validation schemas' control-character rule.

## Running the database tests

```bash
npm run test:db
```

Applies every migration to a throwaway Postgres in Docker and runs the SQL
suite in `supabase/tests` — 143 assertions covering the parts that would be
expensive to get wrong:

- accounts, roles and what each role can and cannot read
- pricing, capacity, re-approval and who may decide a booking
- lesson package credits, extension and dismissal
- inventory levels, rentals and the return path
- review confidentiality, invites, price history and scheduling guards
- what the signing records keep, what they refuse to keep, and who can read them
- two clubs that must never see each other: reads, writes, staff decisions, the operator's view, and an audit that every policy names the club
- plan limits held by the database, billing rows kept inside the club, legal acceptances that cannot be rewritten, and the operator's finance view carrying totals but no member

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
- **Redirects are path-only.** `?next=` goes through `safeInternalPath()`, which
  refuses absolute URLs, `//host`, control characters and the backslash form
  (`/\evil.example`) that browsers resolve as another host. One helper, used
  by every redirect that takes input.
- **Nothing user-typed is spliced into a query.** The admin search term passes
  through `searchTerm()` before it reaches a PostgREST filter string, where
  commas, dots and parentheses are syntax.
- **Database errors are translated, not forwarded.** Wording our own triggers
  raise is shown; wording Postgres generates (which names tables and
  constraints) is replaced with a generic line — `src/lib/db/errors.ts`.
- **Forwarded addresses are validated** before they reach an `inet` column or a
  rate-limit key, so a forged `X-Forwarded-For` cannot fail an insert or pick
  its own bucket.
- **Changing a password ends every other session** for that account.
- **The auth server enforces the same 12-character floor as the app**
  (`minimum_password_length` in `supabase/config.toml`), so a password reset
  — which never passes through the app's own validation — cannot undercut it.
  Set the same value on the hosted project under Authentication → Policies.
- **Login is rate limited** per account and per source address, and failures never
  reveal whether an email exists.
- A **strict CSP built per request** in `src/proxy.ts`, carrying a fresh nonce.
  Next.js streams a page with inline bootstrap scripts, so a static
  `script-src 'self'` blocks every one of them and nothing on the page ever
  hydrates — the nonce is what lets those run without `unsafe-inline`.
  `strict-dynamic` then covers the chunks they load. `unsafe-eval` is added in
  development only, for the dev compiler. Alongside it: HSTS,
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
  0010 … 0012          auth metadata sync, RPC context, document signatures
  0013 … 0014          platform role and multi-tenancy (club_id everywhere)
  0015                 a club's listing details (address, hours, contact, pin)
  0016                 every form of a Google Maps link
  0017                 plans, subscriptions, payout accounts, legal acceptance, finance views
  0018                 review fixes: per-club locks on plan limits, indexes, one Maps rule

src/lib/
  supabase/            the two clients — user (RLS) and admin (service role)
  auth/session.ts      requireRole / assertRole guards
  auth/club-guard.ts   requireClubRole — the address and the profile must agree
  tenant.ts            which club a request is for; club and platform URLs
  support/assistant.ts the Claude-backed support assistant
  places/              reading a club's Google Maps listing (link parser + Places API)
  billing/             plans, the club onboarding gate, payout account state
  legal/               the platform's legal documents, versioned
  finance/             period ranges and payment sums for both dashboards
  actions/             one module per domain, all validated and audited
  validation/          Zod schemas for every input
  payments/            provider interface + Stripe and mock implementations
  surf/                Open-Meteo marine and wind forecast
  util/                money, dates, phone links, rate limiting, invite tokens

src/app/
  admin/ instructor/ client/    the three club areas, each guarded in its layout
  platform/                     the operator: clubs, support inbox, audit
  api/webhooks/payments/        the only route that can mark a payment paid

src/components/
  ui/                  shared primitives — bottom sheet, tab bars, help tooltip
  member/ instructor/ admin/ platform/    the pieces specific to one interface
```

Each interface has its own button set in `src/components/ui/button-class.ts`
(`memberButton`, `instructorButton`, `adminButton`). They are not
interchangeable — passing the wrong family is the quickest way to make a screen
look like a different app.

---

## Known limitations

- **Tested against plain Postgres 15, not against Supabase itself.** The
  migrations apply cleanly and all 143 assertions pass, but the harness stubs the
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
