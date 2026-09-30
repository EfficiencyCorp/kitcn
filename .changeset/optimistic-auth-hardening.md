---
"kitcn": patch
---

## Patches

- Fix the token identity guard letting a token of another user or session reach the store, Convex, cRPC HTTP headers or the TanStack Start loader through the SSR token, a restored session, a sign-in's returned token, a JWT without `exp`, or a concurrent first token.
- Fix a trip leaving the page authenticated: every mounted provider now hands out no token and publishes unauthenticated, each guarded one closes its client and calls `onTokenIdentityChange` once, later providers start tripped, and sign-in mutations fail with `TOKEN_IDENTITY_CHANGED`.
- Fix `optimisticAuth` reopening the gate for a token Convex refused: the optimistic window now ends at the Convex client's first auth result.
