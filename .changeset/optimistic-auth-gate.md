---
"kitcn": patch
---

## Features

- Add `optimisticAuth` to `ConvexAuthProvider`: auth-bound queries run as soon as an unexpired JWT is held instead of after Convex confirms it, and a refused token resets auth-bound queries and never reopens the gate.
- Add `onTokenIdentityChange` to `ConvexAuthProvider`: a document keeps the identity it mounted with (the SSR token) or, with none, the first one it obtains; a token for another user or session is refused before it is cached, so neither Convex nor HTTP requests ever use it, the client is closed (dropping queued requests and optimistic updates) and the callback runs, typically to reload the page.
- Add `tokenIdentityBaseline` to `ConvexAuthProvider`: for an app that mounts the provider more than once per document (for example per route group over a shared Convex client), the identity guard starts from the identity the document already speaks for, so a remount without a token still refuses another user's or session's token. It also accepts a getter, read at every admission (cached tokens included), so a provider kept mounted but hidden (React `<Activity>`) refuses a token once the document has moved to another identity.
- Add `onTokenIdentityAdmitted` to `ConvexAuthProvider`: called with every token the identity guard admits as it is handed out, cached tokens included and refused ones never, so the document can claim the identity at that moment.
- Improve cRPC HTTP headers to take their token from the same fetcher Convex uses, so its guards apply to HTTP requests too.
- Support `optimisticUpdate` in cRPC `mutationOptions`, passed to Convex's own optimistic updates so a refused write rolls back without flicker.

## Patches

- Fix server `ConvexQueryClient` construction calling `Math.random()` (Convex's default logger), which prerendering (Cache Components) refuses: the server HTTP client now reuses the Convex client's logger.
