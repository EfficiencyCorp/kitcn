---
"kitcn": patch
---

## Features

- Add `optimisticAuth` to `ConvexAuthProvider`: until the Convex client reports its first auth result, auth-bound queries run as soon as an unexpired JWT is held instead of after Convex confirms it; after that result the gate follows Convex's confirmed state for the client's lifetime, and a refused token resets auth-bound queries.
- Add `onTokenIdentityChange` to `ConvexAuthProvider`: a document keeps the identity it mounted with (the SSR token, admitted before it is published) or, with none, the first token that carries one (an identity-less JWT establishes nothing); a token for another user or session is refused before it is cached, so neither Convex nor HTTP requests ever use it. A refusal is terminal for the document (in the browser): every mounted provider becomes unauthenticated (auth-bound queries reset) and hands out no token, later providers start tripped, sign-in mutations throw `TOKEN_IDENTITY_CHANGED` (a sign-in returning another identity's JWT is refused and trips), the client is closed, and the callback runs, typically to reload the page. While an identity is established, only a persisted JWT for that identity is restored.
- Add `tokenIdentityBaseline` to `ConvexAuthProvider`: for an app that mounts the provider more than once per document (for example per route group over a shared Convex client), the identity guard starts from the identity the document already speaks for, so a remount without a token still refuses another user's or session's token. It also accepts a getter, read at every admission (cached tokens included), so a provider kept mounted but hidden (React `<Activity>`) refuses a token once the document has moved to another identity.
- Add `onTokenIdentityAdmitted` to `ConvexAuthProvider`: called with every token the identity guard admits, before Convex or HTTP requests receive it, cached tokens included and refused ones never, so the document can claim the identity at that moment.
- Improve cRPC HTTP headers to take their token from the same fetcher Convex uses, so its guards apply to HTTP requests too.
- Support `optimisticUpdate` in cRPC `mutationOptions`, forwarded to Convex's `withOptimisticUpdate`; applying and rolling back the update follow Convex's optimistic update semantics on the data cRPC queries read.

## Patches

- Fix server `ConvexQueryClient` construction calling `Math.random()` (Convex's default logger), which prerendering (Cache Components) refuses: the server HTTP client now reuses the Convex client's logger.
