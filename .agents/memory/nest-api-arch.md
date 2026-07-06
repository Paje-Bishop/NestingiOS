---
name: Nest API architecture
description: Key decisions for the Nest Express+Drizzle backend that aren't obvious from the code
---

## Session tokens
Random UUID stored in `sessions` table + AsyncStorage `nest_auth_token` on mobile. No JWTs. 30-day expiry. `requireAuth` middleware at `artifacts/api-server/src/middleware/auth.ts` does the lookup.

## Phone verification stub
In `NODE_ENV !== "production"` any 6-digit code is accepted — no DB lookup. The `phone_verifications` table and `generateOtp()` are structured for a real SMS swap (add `sendSms()` call in the send-code route).

## Date column mode
All `date()` columns use `{ mode: "string" }` so Drizzle returns/accepts YYYY-MM-DD strings. **But Orval generates `zod.coerce.date()` for OpenAPI `format: date` fields**, so `parsed.data.dueDate` is a `Date` object — convert with `.toISOString().split("T")[0]` before any DB insert or update.

**Why:** Orval coerces dates; Drizzle "string" mode doesn't. Mismatch causes TS2769 on `.values()` and `.set()`.

## req.params typing
In this project's Express typings `req.params.x` is `string | string[]`. Always cast: `req.params.id as string` or `parseInt(req.params.id as string, 10)`.

**Why:** Causes TS2345/TS2769 if you pass the param directly to `eq()` or `parseInt()`.

## Pregnant-person conflict
`POST /invitations/:code/accept` returns 409 if role=`pregnant_person` and one already exists. Add `?forceConvert=true` to override — converts existing to `supporter`. `GET /invitations/:code` returns `existingPregnantPerson: boolean` so the mobile UI can warn before accepting.

## Join URL
Created in `POST /pregnancies/:id/invitations` using `process.env.REPLIT_DOMAINS?.split(",")[0]`. Points to `/onboarding/join-code?code=XXX` for deep linking.
