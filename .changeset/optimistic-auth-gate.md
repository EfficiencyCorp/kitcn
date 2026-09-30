---
"kitcn": patch
---

- Add opt-in optimistic auth and document identity admission to
  `ConvexAuthProvider`, with the same guarded token source for Convex and cRPC
  HTTP requests.
- Add Convex-native `optimisticUpdate` support to cRPC `mutationOptions`.
- Reuse the Convex client's logger for server HTTP clients so construction is
  deterministic during prerendering.
- Keep a token of another user or session out of the store, Convex, cRPC
  HTTP headers and the TanStack Start loader on every path (SSR token,
  restored session, sign-in token, JWTs without `exp`, concurrent first
  tokens), with identity state shared across kitcn's entrypoints.
- Make an identity guard trip page-wide: mounted providers hand out no token
  and publish unauthenticated, each guarded one closes its client and calls
  `onTokenIdentityChange` once, and sign-in mutations fail with
  `TOKEN_IDENTITY_CHANGED`.
- End the `optimisticAuth` window at the Convex client's first auth result,
  so a refused token never reopens it.
