---
"kitcn": patch
---

## Patches

- Fix `onTokenIdentityChange` letting a token of another user or session into
  the auth store, Convex, cRPC HTTP headers or the TanStack Start loader: the
  SSR token, restored sessions, sign-in tokens, JWTs without `exp` and
  concurrent first tokens are all held to the page's identity and every
  mounted provider's current `tokenIdentityBaseline` getter, including changes
  made by `onTokenIdentityAdmitted` before publication.
- Fix an identity guard trip staying local to one provider: every mounted
  provider now hands out no token and publishes unauthenticated, each guarded
  one closes its client and calls `onTokenIdentityChange` once, including a
  guard enabled after the trip, and sign-in
  mutations fail with `TOKEN_IDENTITY_CHANGED` until the page reloads.
- Fix the `optimisticAuth` window reopening after Convex refused a token: it
  now ends at the Convex client's first auth result.
