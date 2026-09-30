// The token identity guard's one admission, and the page state it reads.
//
// Every path that caches, publishes or hands out a token calls `admitToken`
// and keeps no admission logic of its own: SSR hydration, the provider's
// fetcher, restore, sign-in tokens, auth-state publication, HTTP headers and
// the TanStack Start loader.
//
// The page state is browser only and lives on `globalThis`, so every built
// entry (`kitcn/auth/start` is bundled apart from `kitcn/auth/client` and
// `kitcn/react`) shares one copy. On the server, where one module serves many
// requests, it is never created, read or written. No imports, so loaders can
// use it too.

/** One `ConvexAuthProvider`, as the admission sees it. */
export type IdentityGuard = {
  /** `onTokenIdentityChange` is set: the provider binds an identity. */
  guarded: boolean;
  /** `tokenIdentityBaseline`'s current answer (a getter is read each time). */
  baseline: () => string | null;
  /** The baseline is a getter, whose current answer binds every provider. */
  hasGetter: boolean;
  /** The identity this provider was seeded with or admitted. */
  identity: string | null;
  /** Refuses everything: the page tripped, or its SSR token was refused. */
  tripped: boolean;
  /** The token the provider's store holds. */
  heldToken: () => string | null;
  /** `onTokenIdentityAdmitted`. */
  onAdmitted: (token: string) => void;
};

/**
 * - `handout`: to Convex, HTTP headers or the loader. With an identity
 *   guard in play, an opaque session token never goes (it is only the
 *   exchange credential).
 * - `hold`: cached or published in a store; an opaque token may be held as
 *   the exchange credential.
 * - `restore`: a persisted token; an opaque one is not restored once an
 *   identity is established, because it proves none.
 */
export type TokenUse = 'handout' | 'hold' | 'restore';

type PageRegistry = {
  /** A token of another identity was refused somewhere in the page. */
  tripped: boolean;
  tripListeners: Set<() => void>;
  /** The first identity a guard knew, which binds every later token. */
  documentIdentity: string | null;
  /** Mounted providers: their getters bind every admission. */
  guards: Set<IdentityGuard>;
  /** The provider that owns each auth store. */
  storeGuards: WeakMap<object, IdentityGuard>;
  /** Convex clients that reported an auth result (or the Start loader set). */
  settledClients: WeakSet<object>;
  settlementListeners: WeakMap<object, Set<() => void>>;
  /** Clients whose `setAuth` records settlement. */
  watchedClients: WeakSet<object>;
};

const REGISTRY_KEY = Symbol.for('kitcn.identityGuard.v1');

/** The page state, or null on the server, where it is never created. */
export const pageRegistry = (): PageRegistry | null => {
  if (typeof window === 'undefined') return null;
  const scope = globalThis as unknown as Record<
    symbol,
    PageRegistry | undefined
  >;
  scope[REGISTRY_KEY] ??= {
    documentIdentity: null,
    guards: new Set(),
    settledClients: new WeakSet(),
    settlementListeners: new WeakMap(),
    storeGuards: new WeakMap(),
    tripListeners: new Set(),
    tripped: false,
    watchedClients: new WeakSet(),
  };
  return scope[REGISTRY_KEY];
};

export const isDocumentTripped = () => pageRegistry()?.tripped ?? false;

/**
 * Trips the page: every mounted provider hands out no token and publishes
 * unauthenticated, and providers, clients and loaders created later start
 * tripped. A reload clears it.
 */
export const tripDocument = () => {
  const registry = pageRegistry();
  if (!registry || registry.tripped) return;
  registry.tripped = true;
  for (const listener of [...registry.tripListeners]) {
    try {
      listener();
    } catch (error) {
      // One subscriber failing must not stop the others.
      console.error('[kitcn] identity guard trip listener threw', error);
    }
  }
};

export const subscribeDocumentTrip = (listener: () => void) => {
  const registry = pageRegistry();
  if (!registry) return () => {};
  registry.tripListeners.add(listener);
  return () => {
    registry.tripListeners.delete(listener);
  };
};

/** The provider that owns `store`, so store-level paths admit through it. */
export const attachStoreGuard = (
  store: object | undefined,
  guard: IdentityGuard
) => {
  if (store) pageRegistry()?.storeGuards.set(store, guard);
};

export const storeGuard = (store: object | undefined) =>
  store ? pageRegistry()?.storeGuards.get(store) : undefined;

/**
 * Called when a provider commits (a render React discards records nothing):
 * its known identity becomes the page's if none is recorded, its getter binds
 * every admission until it unmounts, and the tokens every mounted store
 * already holds are reconciled against the page (a mismatch trips it).
 */
export const mountGuard = (guard: IdentityGuard) => {
  const registry = pageRegistry();
  if (!registry) return () => {};
  registry.guards.add(guard);
  if (guard.guarded && guard.identity) {
    registry.documentIdentity ??= guard.identity;
  }
  for (const mounted of [...registry.guards]) {
    const held = mounted.heldToken();
    if (held && isJwt(held) && !isTokenAdmissible(held, mounted, 'hold')) {
      tripDocument();
      break;
    }
  }
  return () => {
    registry.guards.delete(guard);
  };
};

/**
 * Every identity a token must match at this moment: the page's, every
 * mounted getter's current answer and, for a guarded provider, its own
 * baseline and admitted identity.
 */
const boundIdentities = (guard: IdentityGuard | undefined) => {
  const registry = pageRegistry();
  const bound = [registry?.documentIdentity ?? null];
  if (guard?.guarded) bound.push(guard.identity, guard.baseline());
  for (const mounted of registry?.guards ?? []) {
    if (mounted.hasGetter) bound.push(mounted.baseline());
  }
  return bound.filter((identity): identity is string => identity !== null);
};

/** Whether `token` would be admitted now. No trip, no record, no callback. */
export const isTokenAdmissible = (
  token: string,
  guard: IdentityGuard | undefined,
  use: TokenUse
) => {
  if (isDocumentTripped() || guard?.tripped) return false;
  const bound = boundIdentities(guard);
  if (!isJwt(token)) {
    if (use === 'hold') return true;
    if (use === 'restore') return bound.length === 0;
    return !guard?.guarded && bound.length === 0;
  }
  const identity = decodeTokenSubjectSessionIdentity(token);
  // A JWT without an identity cannot prove the established one.
  return identity === null
    ? bound.length === 0
    : bound.every((known) => known === identity);
};

/**
 * The one admission. In order: the page trip; the opaque-token policy; the
 * identity, which must match every bound identity (a refused JWT trips the
 * page); `onTokenIdentityAdmitted` when `announce`; and the trip again, since
 * the callback may have tripped the page.
 */
export const admitToken = (
  token: string,
  {
    announce = false,
    guard,
    use,
  }: { announce?: boolean; guard?: IdentityGuard; use: TokenUse }
) => {
  if (!isTokenAdmissible(token, guard, use)) {
    if (isJwt(token)) {
      if (guard) guard.tripped = true;
      tripDocument();
    }
    return false;
  }
  if (guard?.guarded && isJwt(token)) {
    const identity = decodeTokenSubjectSessionIdentity(token);
    if (identity !== null) {
      guard.identity = identity;
      const registry = pageRegistry();
      if (registry) registry.documentIdentity ??= identity;
    }
    if (announce) guard.onAdmitted(token);
  }
  return !isDocumentTripped() && !guard?.tripped;
};

/** A JWT's payload: three segments whose middle one is a JSON object. */
function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length !== 3 || !segments[1]) return null;
  try {
    const payload: unknown = JSON.parse(
      atob(segments[1].replaceAll('-', '+').replaceAll('_', '/'))
    );
    return typeof payload === 'object' &&
      payload !== null &&
      !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether a token is a JWT, by structure and whatever its `exp`: every JWT
 * goes through identity admission; only other strings (opaque session
 * tokens) are exchange credentials.
 */
export const isJwt = (token: string) => decodeJwtClaims(token) !== null;

/**
 * The user and session a Better Auth Convex JWT speaks for (`sub` and
 * `sessionId`), or null. Other claims (name, email, updatedAt) may change
 * within one session and do not count.
 */
export function decodeTokenSubjectSessionIdentity(
  token: string | null
): string | null {
  const claims = token ? decodeJwtClaims(token) : null;
  if (!claims || typeof claims.sub !== 'string') return null;
  const sessionId =
    typeof claims.sessionId === 'string' ? claims.sessionId : '';
  return `${claims.sub}|${sessionId}`;
}

/** Test-only: clear the trip and the page identity between tests. */
export const resetDocumentTripForTests = () => {
  const registry = pageRegistry();
  if (!registry) return;
  registry.tripped = false;
  registry.documentIdentity = null;
};
