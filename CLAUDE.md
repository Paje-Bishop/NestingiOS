# CLAUDE.md — Nest

Nest is a pregnancy companion app: a private, collaborative space where expecting
families prepare together, stay connected, and preserve the story of their pregnancy.

> Source of truth for product/spec is **Notion** ("Nest Product" workspace). This file
> summarizes the architecture and the hard rules an implementation agent must not drift
> from. When product questions arise, defer to Notion (PRD, DM-001, FS-xxx, ADRs) and the
> **Nest Cross-Agent Log** database.
>
> This file was verified against the cloned repo (`Paje-Bishop/NestingiOS`) and `replit.md`.
> For run/operate commands and low-level gotchas, `replit.md` and `.agents/memory/*` are the
> authoritative local references; this file adds product/domain context from Notion.

## Stack

pnpm workspaces monorepo. Node 24, TypeScript 5.9. Package names are `@workspace/*`.

- **Mobile client** — `artifacts/mobile` (`@workspace/mobile`): Expo / React Native,
  Expo Router, iOS-first. Server data via **React Query** through `@workspace/api-client-react`.
- **API server** — `artifacts/api-server` (`@workspace/api-server`): **Express 5**. Runs on
  port **8080**, proxied at `/api`. Build via esbuild (CJS bundle).
- **Shared libs** — `lib/*`:
  - `lib/db` (`@workspace/db`) — Drizzle table definitions in `lib/db/src/schema/`.
  - `lib/api-spec` — **`openapi.yaml`, the source of truth for all API contracts.**
  - `lib/api-client-react` — generated React Query hooks + custom fetch with auth injection.
  - `lib/api-zod` — generated Zod schemas for server-side validation.
- `scripts/` — tooling.

### Run / operate (see replit.md for full list)
- `pnpm --filter @workspace/api-server run dev` — API (port 8080)
- `pnpm --filter @workspace/mobile run dev` — Expo app
- `pnpm run typecheck` / `pnpm run build` — across all packages
- Required env: `DATABASE_URL` (Postgres connection string)
- **Never run `pnpm dev` at the workspace root.**

### API contracts are code-generated (important workflow)
`lib/api-spec/openapi.yaml` is the contract source of truth. **Orval** generates the React
Query hooks (`api-client-react`) and Zod schemas (`api-zod`) from it. After editing
`openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`. After Drizzle schema
changes, run `pnpm --filter @workspace/db run push` (dev). Don't hand-edit generated files.

## Database — READ THIS FIRST

- The database is **PostgreSQL**, accessed exclusively through **Drizzle ORM**.
- It is **NOT MongoDB**. Do **not** introduce MongoDB, Mongoose, or any document/NoSQL
  database. Data is relational and modeled per DM-001.
- Postgres is hosted on **Supabase free tier**, but used as a **plain Postgres database
  only** — connected via a standard `DATABASE_URL` behind Drizzle.

### Supabase anti-lock-in guardrail (locked decision, do not drift)

Supabase is "just the database." Specifically, do **NOT**:
- wire the app into **Supabase Auth**,
- use the **`supabase-js`** client SDK,
- enable **Supabase Row-Level Security (RLS)**.

Nest has its own auth (sessions table), its own validation (zod), and its own Express API.
Keeping Supabase as plain Postgres preserves zero lock-in — moving to Neon/Railway/any
Postgres host stays a one-line `DATABASE_URL` swap. The moment code uses Supabase Auth or
its SDK is where painful migration risk begins.

Deferred (safe to defer): photo/object storage for Memories (FS-012) — add Supabase
Storage OR a separate object store (R2 / S3 / Cloudinary) when photo-Memories ship.

## Auth

- **Phone number is identity.** Verification-code flow (Tinder-style). Phone number is
  unique per Person; no duplicate accounts possible.
- **Sessions as bearer tokens:** random UUID stored in the `sessions` table + AsyncStorage
  key `nest_auth_token` on device. **No JWTs.** 30-day expiry. `requireAuth` middleware at
  `artifacts/api-server/src/middleware/auth.ts`. Plus `phone_verifications` for OTP. Not
  Supabase Auth.
- **Invite links carry a pregnancy join code** (not phone-bound) — anyone with the link
  can join by verifying any phone number. Existing accounts log in; new numbers create a
  new account. No matching of verified phone against the invited number.
- Validation via **zod** at the API boundary.

### Known gap / in-flight
- **SMS is a dev stub.** In `NODE_ENV !== "production"` any six-digit code is accepted (no
  DB lookup). `phone_verifications` + `generateOtp()` are structured for a real SMS swap
  (add a `sendSms()` call in the send-code route). Remove the dev bypass before external
  testing.
- Decided direction: **Twilio Verify** for login OTP, **Twilio Messaging** for invitation
  links. Provider credentials go in deployment secrets. Add rate-limit / error handling.
- Onboarding **Create** and **Join** flows are already wired to the API (create pregnancy /
  accept invitation) — the Notion log's "mobile is local-only, API not wired" note is stale
  as of commit `57c6938`. AsyncStorage now holds only auth/session state, not domain data.

### Codegen / typing gotchas (from .agents/memory)
- **Dates:** Drizzle `date()` columns use `{ mode: "string" }` (YYYY-MM-DD), but Orval
  generates `zod.coerce.date()`, so parsed date fields are `Date` objects — convert with
  `.toISOString().split("T")[0]` before any DB insert/update, or you get TS2769.
- **Orval mutations** wrap the body: `mutate({ data: { ... } })`, not the body directly.
- **`req.params.x` is typed `string | string[]`** — always cast: `req.params.id as string`.
- Pregnant-person conflict: `POST /invitations/:code/accept` returns **409** if a
  `pregnant_person` exists; pass `?forceConvert=true` to convert the existing one to
  supporter. `GET /invitations/:code` returns `existingPregnantPerson` so the UI can warn.

## Domain model (DM-001) — the essentials

**Pregnancy is the primary object.** People persist; pregnancies come and go. A Person
participates in a Pregnancy through a **Membership**, which defines role, permissions,
notification prefs, and personalization. (ADR-001 pregnancy-centric, not household-centric.)

Core entities (all Pregnancy-owned unless noted):
Person*, Pregnancy, Membership, Invitation, Task, SharedDecision, DecisionContribution,
UserRegistryItem, BudgetPurchase, Memory, Notification, FamilyProfile, LaborSession,
ContractionEvent, OurJourneyExport. Global (not Pregnancy-owned) content: **JourneyWeek,
RegistryItem, BudgetCategoryGuide**. (*Person is account-level, cross-pregnancy.)

Key rules:
- **Roles:** `Pregnant Person` | `Supporter` only. A Pregnancy has 0-or-1 Pregnant Person
  and any number of Supporters. If someone claims Pregnant Person and one exists, the prior
  one auto-becomes Supporter — **no data is ever deleted or reassigned** on role change.
- **Pregnancy status (MVP):** `Active → In Labor → Completed`, plus `Active → Ended Early`.
  In Labor is reversible to Active (false alarm), has no timeout, ends manually via
  "Baby's here." All other forward transitions are one-way for MVP.
- **Archive is a Membership state** (`Active ↔ Archived`), reversible, per-member — NOT a
  Pregnancy status. Never model it as a Pregnancy status.
- **Fourth Trimester is post-MVP.** Do not add it to any MVP spec or schema work. It exists
  in DM-001/PRD only as a clearly-labeled future state.
- **Memory visibility** is `Private` or `Public` (never "Shared"). Public means visible
  within the Pregnancy, not internet-public. Only the author changes visibility.
- **Favor preservation over deletion.** Leaving/removal deactivates a Membership rather
  than deleting it (preserving authorship). Permanent deletion is the only irreversible
  MVP action.
- Naming/field locks: **`talkTogetherFlag`** (not `partnerDiscussionFlag`) on RegistryItem;
  **`isUserAdded`** on Task; **BudgetPurchase** is the single source of truth for
  price/merchant/gift (UserRegistryItem holds no financial data); SharedDecision uses
  **DecisionContribution** records, not a free-text notes field;
  `FamilyProfile.notificationDefaults` seeds a Membership's prefs once at join, then
  independent.
- Notifications (ADR-007): global cap **2/day per member**, per-type caps, quiet hours
  **8am-8pm local**, role-aware.

## UI / product conventions

- **Terminology is locked** — do not silently rename. Home's collective section is
  **"Progress"** (not "Team Progress" / "Household Progress"). Avoid all household language.
- **Role drives content, not just copy.** Pregnant Person and Supporter see different
  priority ordering, not re-skinned text (ADR-002).
- **Home owns no data** — it's a read-mostly aggregation of Task, SharedDecision,
  BudgetPurchase, JourneyWeek, Memory. Six sections (This Week, For You, Shared Decisions,
  Progress, Budget Snapshot, Memory Prompt). Omit empty sections rather than showing weak
  placeholders. "For You" shows exactly one item.
- **Copy follows the Nest Content Bible**: warm, clear, reassuring, non-clinical, role-aware.
  No relationship labels ("Mom/Dad") unless user-entered. No shame/percentage framing.
  "Gentle Momentum" pattern: celebrate collective motion, never call out inaction.
- Onboarding (FS-001) is low-friction (~8 steps), pregnancy-first, invitations always
  explicit Accept/Decline. Interrupted onboarding restarts from the beginning (no resume).
- Journey content is **hardcoded/preloaded for MVP** — no CMS.

## Cross-Agent Log protocol (important)

Two agents collaborate through the **Nest Cross-Agent Log** Notion database:
- **Agent 1** (Claude) — product/strategy, spec + doc owner, reviewer.
- **Agent 2** (ChatGPT) — design + app-build.

Rules:
- Row statuses: `Not started` → `In progress` (impl done, awaiting review) → `Done`
  (reviewer verified). Agent 2 sets `In progress`; **only Agent 1 sets `Done`** after
  opening the Doc Link and confirming the content actually exists.
- **Always verify "Done"/completion claims by fetching the linked doc** — Agent 2 has
  fabricated completion claims (marked rows Done / claimed edits that never landed).
- Do not re-litigate locked decisions or add/remove DM-001 entities, Pregnancy statuses, or
  locked terminology without a logged, user-approved Decision row.

## Environment / hosting (unsettled)

- Build environment is moving **from Replit to Claude Code**. Claude Code is a builder, not
  a host — the always-on API still needs a deploy target (Railway / Render / Fly / Replit
  Autoscale / etc.). The earlier "Replit Autoscale" note assumed a paid Replit plan and
  should be revisited when the hosting target is finalized.
- Backend is standard Express + Postgres/Drizzle, so there is no host lock-in.

## Guardrails summary (do NOT do these)

1. No MongoDB / Mongoose / any NoSQL. Postgres + Drizzle only.
2. No Supabase Auth, no `supabase-js`, no RLS. Supabase = plain Postgres via `DATABASE_URL`.
3. Don't rename locked terms (Progress, role names, `talkTogetherFlag`, `isUserAdded`, etc.).
4. Don't add Fourth Trimester or any post-MVP entity to MVP work.
5. Don't model Archive as a Pregnancy status — it's a Membership state.
6. Don't delete domain data on role change / leave / remove — deactivate/preserve instead.
7. Trust Notion as source of truth; verify agent completion claims against the live doc.
