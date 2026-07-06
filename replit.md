# Nest

A warm pregnancy companion iOS app with a real Express+PostgreSQL backend.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Mobile: Expo / React Native, React Query, `@workspace/api-client-react`

## Where things live

- `lib/db/src/schema/` — all Drizzle table definitions (persons, pregnancies, memberships, invitations, sessions, phone_verifications, analytics_events)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/api-client-react/src/` — generated React Query hooks + custom fetch with auth token injection
- `lib/api-zod/src/` — generated Zod schemas for server-side validation
- `artifacts/api-server/src/routes/` — Express route handlers (auth, persons, pregnancies, invitations, analytics)
- `artifacts/mobile/context/AppContext.tsx` — auth session state (authToken, personId, currentPregnancyId) backed by AsyncStorage
- `artifacts/mobile/app/onboarding/` — onboarding flow screens

## Architecture decisions

- **Sessions as bearer tokens**: UUID token stored in `sessions` table + AsyncStorage `nest_auth_token` on device. No JWTs.
- **Phone verification (dev stub)**: Any 6-digit code is accepted in `NODE_ENV !== "production"`. `phoneVerifications` table is ready for a real SMS provider swap.
- **Date column mode**: All `date()` columns use `{ mode: "string" }` so Drizzle returns YYYY-MM-DD strings. Orval generates `zod.coerce.date()` for date fields — convert with `.toISOString().split("T")[0]` before DB insert/update.
- **Join flow tracking**: `onboardingData.inviteCode` in AppContext signals the join path; name.tsx checks it and routes to `join-role` instead of `role`.
- **Pregnant-person conflict**: `POST /invitations/:code/accept` returns 409 if a `pregnant_person` already exists; pass `?forceConvert=true` to override (converts existing to supporter).
- **API base URL**: Set via `EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN` in mobile workflow; `setBaseUrl()` called in AppProvider.

## Product

Nest helps pregnant people and their supporters stay in sync throughout pregnancy. Core flows:
1. **Create** — phone verify → name → role → due date → pregnancy name → invite → notifications → complete (creates pregnancy via API)
2. **Join** — enter invite code → preview invitation → phone verify → name → select role → join pregnancy (accepts invitation via API)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Never run `pnpm dev` at workspace root** — use `restart_workflow` instead.
- **After changing openapi.yaml**, run `pnpm --filter @workspace/api-spec run codegen` — also runs `typecheck:libs`.
- **After schema changes**, run `pnpm --filter @workspace/db run push` for dev DB migrations.
- **`req.params` is typed `string | string[]`** in this project's Express typings — always cast with `req.params.x as string` or `parseInt(req.params.x as string, 10)`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
