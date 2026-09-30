---
"kitcn": patch
---

## Features

- Add `optimisticAuth` to `ConvexAuthProvider`: until the Convex client reports its first auth result, auth-bound queries run as soon as an unexpired JWT is held instead of after Convex confirms it; after that result the gate follows Convex's confirmed state for the client's lifetime, and a refused token resets auth-bound queries.
- Add `onTokenIdentityChange` to `ConvexAuthProvider`: a document keeps the identity it mounted with (the SSR token) or, with none, the first token that carries one (an identity-less JWT establishes nothing); a token of another user or session is never cached, published, or handed to Convex, cRPC HTTP requests or the TanStack Start loader. On refusing one, kitcn stops handing out tokens, publishes unauthenticated, closes the Convex client and calls the callback, where the app should reload the page; until then, sign-in mutations fail with `TOKEN_IDENTITY_CHANGED`.
- Add `tokenIdentityBaseline` to `ConvexAuthProvider`: for an app that mounts the provider more than once per document (for example per route group over a shared Convex client), the identity guard starts from the identity the document already speaks for, so a remount without a token still refuses another user's or session's token. It also accepts a getter, read at every admission (cached tokens included), so a provider kept mounted but hidden (React `<Activity>`) refuses a token once the document has moved to another identity.
- Add `onTokenIdentityAdmitted` to `ConvexAuthProvider`: called with every token the identity guard admits, before Convex or HTTP requests receive it, cached tokens included and refused ones never, so the document can claim the identity at that moment.
- Improve cRPC HTTP headers to take their token from the same fetcher Convex uses, so its guards apply to HTTP requests too.
- Support `optimisticUpdate` in cRPC `mutationOptions`, forwarded to Convex's `withOptimisticUpdate`; applying and rolling back the update follow Convex's optimistic update semantics on the data cRPC queries read.

## Patches

- Fix server `ConvexQueryClient` construction calling `Math.random()` (Convex's default logger), which prerendering (Cache Components) refuses: the server HTTP client now reuses the Convex client's logger.
