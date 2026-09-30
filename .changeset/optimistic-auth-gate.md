---
"kitcn": patch
---

- Add opt-in optimistic auth and document identity admission to
  `ConvexAuthProvider`, with the same guarded token source for Convex and cRPC
  HTTP requests.
- Add Convex-native `optimisticUpdate` support to cRPC `mutationOptions`.
- Reuse the Convex client's logger for server HTTP clients so construction is
  deterministic during prerendering.
