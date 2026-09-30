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
  /**
   * `onTokenIdentityChange` is set: the provider binds an identity. Read at
   * every commit, so a guard enabled after mount joins the page then.
   */
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
  /**
   * Set only on a local stand-in for a registry of another shape found under
   * the key (mixed kitcn revisions, dev HMR): guarded admissions fail closed.
   */
  incompatible?: true;
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

// Bump the key on any change to the registry's shape: copies of kitcn from
// different revisions in one page (dev HMR, mixed bundles) must never share
// an object they read differently. Two kitcn versions or revisions on one page
// are unsupported: entries under different keys, or next to an incompatible
// object under this key, share no page identity until the page reloads; the
// entry that detects an incompatible object fails its guarded admissions
// closed.
const REGISTRY_KEY = Symbol.for('kitcn.identityGuard.v2');

const createRegistry = (): PageRegistry => ({
  documentIdentity: null,
  guards: new Set(),
  settledClients: new WeakSet(),
  settlementListeners: new WeakMap(),
  storeGuards: new WeakMap(),
  tripListeners: new Set(),
  tripped: false,
  watchedClients: new WeakSet(),
});

const isRegistry = (value: unknown): value is PageRegistry => {
  const candidate = value as Partial<PageRegistry> | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.tripped === 'boolean' &&
    (candidate.documentIdentity === null ||
      typeof candidate.documentIdentity === 'string') &&
    candidate.tripListeners instanceof Set &&
    candidate.guards instanceof Set &&
    candidate.storeGuards instanceof WeakMap &&
    candidate.settledClients instanceof WeakSet &&
    candidate.settlementListeners instanceof WeakMap &&
    candidate.watchedClients instanceof WeakSet
  );
};

let incompatibleStandIn: PageRegistry | undefined;

/**
 * The page state, or null on the server, where it is never created. An
 * object of another shape under the key is never used: this copy of kitcn
 * gets a local stand-in on which guarded admissions fail closed.
 */
export const pageRegistry = (): PageRegistry | null => {
  if (typeof window === 'undefined') return null;
  const scope = globalThis as unknown as Record<symbol, unknown>;
  scope[REGISTRY_KEY] ??= createRegistry();
  const found = scope[REGISTRY_KEY];
  if (isRegistry(found)) return found;
  if (!incompatibleStandIn) {
    console.warn(
      '[kitcn] identity guard state of another kitcn revision is on this page; guarded providers hand out no token until the page reloads.'
    );
    incompatibleStandIn = { ...createRegistry(), incompatible: true };
  }
  return incompatibleStandIn;
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
 * Called when a provider joins the page (its first commit; a render React
 * discards records nothing): its known identity becomes the page's if none is
 * recorded, its getter binds every admission until it unmounts, and the
 * tokens every mounted store already holds are reconciled against the page (a
 * mismatch trips it). After that, held tokens are reconciled at every
 * admission.
 */
export const mountGuard = (guard: IdentityGuard) => {
  const registry = pageRegistry();
  if (!registry) return () => {};
  registry.guards.add(guard);
  joinPage(guard);
  return () => {
    registry.guards.delete(guard);
  };
};

/**
 * A mounted provider's guard joins the page: at its first commit, or at the
 * commit that enables it.
 */
export const joinPage = (guard: IdentityGuard) => {
  const registry = pageRegistry();
  if (!registry) return;
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
};

const guardedProviderMounted = () =>
  [...(pageRegistry()?.guards ?? [])].some((mounted) => mounted.guarded);

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

/**
 * Whether an identity guard is in play for `guard`'s tokens: it is guarded, a
 * guarded provider is mounted, or an identity binds the page. With none, the
 * page behaves as if the guard did not exist.
 */
export const identityGuardInPlay = (guard: IdentityGuard | undefined) =>
  !!guard?.guarded ||
  boundIdentities(guard).length > 0 ||
  guardedProviderMounted();

/** Whether `token` would be admitted now. No trip, no record, no callback. */
export const isTokenAdmissible = (
  token: string,
  guard: IdentityGuard | undefined,
  use: TokenUse
) => {
  if (isDocumentTripped() || guard?.tripped) return false;
  if (guard?.guarded && pageRegistry()?.incompatible) return false;
  const bound = boundIdentities(guard);
  if (!isJwt(token)) {
    if (use === 'hold') return true;
    if (use === 'restore') return bound.length === 0;
    return !identityGuardInPlay(guard);
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
  // The first identity admitted on a guarded page claims it, whoever admits
  // it (a guarded provider, or the Start loader over a guarded page).
  const identity = isJwt(token)
    ? decodeTokenSubjectSessionIdentity(token)
    : null;
  if (identity !== null && (guard?.guarded || guardedProviderMounted())) {
    if (guard?.guarded) guard.identity = identity;
    const registry = pageRegistry();
    if (registry) registry.documentIdentity ??= identity;
  }
  if (announce && guard?.guarded && isJwt(token)) guard.onAdmitted(token);
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
