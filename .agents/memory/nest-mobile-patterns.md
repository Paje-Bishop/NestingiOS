---
name: Nest mobile patterns
description: Non-obvious conventions for the Nest Expo app that bite if forgotten
---

## Orval mutation call shape
Orval-generated mutation hooks wrap the body in `{ data: ... }`:
```ts
sendCode.mutate({ data: { phone: digits } });
verifyCode.mutate({ data: { phone, code } });
updateMe.mutateAsync({ data: { displayName: name } });
createPregnancy.mutateAsync({ data: { name, dueDatePrecision, role } });
createInvitation.mutate({ pregnancyId, data: { inviteeName, inviteePhone } });
```
Passing the body directly (without `data:`) causes TS2353 at compile time.

## AppContext auth flow
AppContext holds `{ authToken, personId, currentPregnancyId }` from AsyncStorage.
- `setAuthSession(token, personId)` — called after phone verification success
- `setCurrentPregnancy(pregnancyId)` — called after creating or joining a pregnancy
- `isOnboardingComplete = authToken !== null && currentPregnancyId !== null`
- `setBaseUrl` + `setAuthTokenGetter` called once in AppProvider `useEffect`

## Join flow signal
`onboardingData.inviteCode` (string field on OnboardingData) signals the join path.
- Set in `join-code.tsx` when invite lookup succeeds
- Checked in `name.tsx` — routes to `join-role` (not `role`) when present
- Read in `join-role.tsx` as fallback: `params.inviteCode ?? onboardingData.inviteCode`

**Why:** Avoids threading params through every intermediate screen.

## Font export casing
`@expo-google-fonts/dm-serif-display` exports `DMSerifDisplay_400Regular` (capital DM, not Dm). Using `DmSerifDisplay_400Regular` compiles but causes a TypeScript error and may silently fail at runtime.

## useGetMe options
Don't pass `{ query: { enabled, staleTime } }` to `useGetMe()` — `UseQueryOptions` requires `queryKey` at the type level in the version used here. Call bare `useGetMe()` and rely on React Query defaults.
