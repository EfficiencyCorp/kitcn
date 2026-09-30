'use client';

/**
 * Unified Convex + Better Auth provider
 */

import type { AuthTokenFetcher } from 'convex/browser';
import type { ConvexReactClient } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { CRPCClientError, defaultIsUnauthorized } from '../crpc/error';
import {
  clearAuthSessionFallback,
  readAuthSessionFallbackData,
  readAuthSessionFallbackToken,
  writeAuthSessionFallbackData,
} from '../react/auth-session-fallback';
import {
  AUTH_SESSION_SYNC_GRACE_MS,
  AuthProvider,
  type AuthStore,
  ConvexProviderWithAuth,
  decodeJwtExp,
  FetchAccessTokenContext,
  isSessionSyncGraceActive,
  useAuthStore,
  useAuthValue,
} from '../react/auth-store';
import {
  decodeTokenIdentity,
  isDocumentTripped,
  recordDocumentIdentity,
  subscribeDocumentTrip,
  tripDocument,
} from '../react/identity-guard-trip';
import {
  admitToken,
  publishAuthState,
  publishToken,
  registerTokenAdmission,
  type TokenAdmission,
} from '../react/token-gate';
import {
  isClientSettled,
  subscribeClientSettlement,
  watchClientSettlement,
} from './client-settlement';
import type { ConvexAuthProviderClient } from './types';

type AuthClientFetch = ConvexAuthProviderClient & {
  $fetch?: (
    path: string,
    options?: {
      credentials?: RequestCredentials;
      headers?: Record<string, string>;
    }
  ) => Promise<{ data?: unknown } | null | undefined>;
};

type AuthGetSession = (options?: {
  fetchOptions?: {
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
  };
}) => Promise<unknown> | unknown;

type AuthSessionAtom = {
  get?: () =>
    | {
        refetch?: (...args: never[]) => unknown;
      }
    | undefined;
  set?: (state: {
    data: unknown;
    error: null;
    isPending: false;
    isRefetching: false;
    refetch: (...args: never[]) => unknown;
  }) => void;
};

type IConvexReactClient = {
  setAuth(fetchToken: AuthTokenFetcher): void;
  clearAuth(): void;
};

export type ConvexAuthProviderQueryClient = {
  updateAuthStore: (authStore?: AuthStore) => void;
};

export type ConvexAuthProviderProps = {
  children: ReactNode;
  /** Convex client instance */
  client: ConvexReactClient;
  /** Better Auth client instance */
  authClient: ConvexAuthProviderClient;
  /** Shared Convex query client to sync with auth state */
  convexQueryClient?: ConvexAuthProviderQueryClient;
  /** Initial session token (from SSR) */
  initialToken?: string;
  /** Callback when mutation called while unauthorized */
  onMutationUnauthorized?: () => void;
  /** Callback when query called while unauthorized */
  onQueryUnauthorized?: (info: { queryName: string }) => void;
  /** Custom function to detect UNAUTHORIZED errors. Default checks code property. */
  isUnauthorized?: (error: unknown) => boolean;
  /**
   * Run auth-bound queries as soon as an unexpired JWT is held instead of
   * after Convex confirms it, until the Convex client reports its first auth
   * result (confirmed or refused); after that the gate follows Convex's
   * confirmed state for the client's lifetime, remounts included. Convex
   * sends them after Authenticate on the same socket and evaluates none of
   * them if the token is refused; a refused token sets `isAuthenticated` back
   * to false, which resets auth-bound queries. With the identity guard, only
   * a token the guard admits opens it. No effect over a client the TanStack
   * Start loader already authenticated. Every provider over one Convex client
   * must use the same setting: mixing optimistic and non-optimistic providers
   * over one client is unsupported, because results the client reports
   * before an optimistic provider mounts are not seen. Default `false`.
   */
  optimisticAuth?: boolean;
  /**
   * Fix the identity (JWT `sub` and `sessionId`) the document speaks for: the
   * one it holds when it mounts (`initialToken`), or, with none, the first
   * token that carries one. Guarantees: (1) a token of another user or
   * session (or a JWT without an identity once one is established) is never
   * cached, published, or handed to Convex, cRPC HTTP or the Start loader;
   * (2) when a trip happens (this or another provider, or the Start loader,
   * refuses one), this provider stops handing out tokens (null), publishes
   * unauthenticated, calls `client.close()` (Convex's close semantics govern
   * its queued work) and then this, once, where the app should reload the
   * page. A provider mounted after the trip starts tripped and does not call
   * it.
   * The trip is page-wide in the browser (never on the server); sign-in
   * mutations fail with `AuthMutationError` code `TOKEN_IDENTITY_CHANGED`
   * until the reload. It governs the token kitcn supplies, not an
   * `Authorization` header the app sets itself. Same-session refreshes pass
   * through. Off when not set.
   */
  onTokenIdentityChange?: () => void;
  /**
   * The identity (`sub|sessionId`, as the guard decodes it from a JWT) the
   * document already speaks for when this provider mounts, for an app that
   * mounts the provider more than once in one document (for example one per
   * route group, over a shared Convex client). The guard starts from it
   * instead of from `initialToken` or the first token obtained, so a remount
   * without a token still refuses another user's or session's token.
   *
   * A fixed value is read on the first render only. A getter is read at
   * every admission, cached tokens included, and a token must match both the
   * identity it returns and the one this guard already admitted; any
   * mismatch trips the guard. So a provider kept mounted but hidden (React
   * `<Activity>`) cannot resume under an identity the document has since
   * moved away from. A getter returning null does not constrain. Needs
   * `onTokenIdentityChange`.
   */
  tokenIdentityBaseline?: string | null | (() => string | null);
  /**
   * Called synchronously with every token the identity guard admits, before
   * Convex or HTTP headers receive it: a fresh token when it is admitted and
   * cached, a cached token each time it is handed out. The document can claim
   * the identity at that moment (for example the first token a document
   * without one obtains). Never called for a refused token. Read from a ref,
   * so passing a new function does not re-run effects. Needs
   * `onTokenIdentityChange`.
   */
  onTokenIdentityAdmitted?: (token: string) => void;
};

const defaultMutationHandler = () => {
  throw new CRPCClientError({
    code: 'UNAUTHORIZED',
    functionName: 'mutation',
  });
};

const hasActiveSessionData = (session: unknown) => {
  if (!session || typeof session !== 'object') {
    return false;
  }
  return Boolean((session as { session?: unknown }).session);
};

const getSessionId = (sessionData: unknown) => {
  if (!sessionData || typeof sessionData !== 'object') {
    return;
  }
  const session = (sessionData as { session?: unknown }).session;
  if (!session || typeof session !== 'object') {
    return;
  }
  const id = (session as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
};

const isSameSession = (left: unknown, right: unknown) => {
  if (left === right) {
    return true;
  }
  const leftId = getSessionId(left);
  return leftId !== undefined && leftId === getSessionId(right);
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const PERSISTED_TOKEN_RETRY_BASE_MS = 100;
const PERSISTED_TOKEN_RETRY_MAX_MS = 2000;

/**
 * `session` — the server returned one.
 * `none` — the server answered and there is no session. Definitive.
 * `unknown` — every attempt failed in transport. Says nothing about the token.
 */
type PersistedTokenOutcome =
  | { data: unknown; status: 'session' }
  | { status: 'none' }
  | { status: 'unknown' };

// `/get-session` answers an unknown or expired token with 200 and a null body,
// and the client resolves transport failures to `{ data: null, error }` instead
// of throwing. `.error` is the only thing separating "no session" from "the
// request never landed", so it has to be read.
const readAuthResult = (result: unknown) => {
  if (!result || typeof result !== 'object') {
    return { data: undefined, errored: true };
  }

  const { data, error } = result as { data?: unknown; error?: unknown };

  return { data, errored: Boolean(error) };
};

// A thrown request is indistinguishable from a resolved one carrying `.error`,
// so both surface as an errored result rather than as a rejection.
const fetchPersistedSession = async (
  authClient: AuthClientFetch,
  token: string
) => {
  const getSession = authClient.getSession as AuthGetSession | undefined;

  try {
    return await (authClient.$fetch
      ? authClient.$fetch('/get-session', {
          credentials: 'omit',
          headers: { Authorization: `Bearer ${token}` },
        })
      : getSession?.({
          fetchOptions: {
            credentials: 'omit',
            headers: { Authorization: `Bearer ${token}` },
          },
        }));
  } catch (error) {
    return { data: undefined, error };
  }
};

const fetchPersistedSessionBeforeDeadline = async (
  authClient: AuthClientFetch,
  token: string,
  deadline: number
): Promise<{ result: unknown; status: 'result' } | { status: 'deadline' }> => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return { status: 'deadline' };
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadlineResult = new Promise<{ status: 'deadline' }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ status: 'deadline' }), remaining);
  });

  try {
    return await Promise.race([
      fetchPersistedSession(authClient, token).then((result) => ({
        result,
        status: 'result' as const,
      })),
      deadlineResult,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

// Retries are bounded by the same grace window the caller opened, so the
// recovery always terminates: either the server answers, or the window closes
// and the caller resolves the optimistic state it created.
const getSessionFromPersistedToken = async (
  authClient: AuthClientFetch,
  token: string,
  { deadline, shouldStop }: { deadline: number; shouldStop: () => boolean }
): Promise<PersistedTokenOutcome> => {
  for (let attempt = 0; ; attempt += 1) {
    // Only retries wait, so a live token costs one immediate request.
    if (attempt > 0) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return { status: 'unknown' };
      }

      await wait(
        Math.min(
          PERSISTED_TOKEN_RETRY_BASE_MS * 3 ** (attempt - 1),
          PERSISTED_TOKEN_RETRY_MAX_MS,
          remaining
        )
      );
    }

    if (shouldStop()) {
      return { status: 'unknown' };
    }

    const request = await fetchPersistedSessionBeforeDeadline(
      authClient,
      token,
      deadline
    );
    if (request.status === 'deadline') {
      return { status: 'unknown' };
    }
    const { data, errored } = readAuthResult(request.result);

    if (data) {
      return { data, status: 'session' };
    }
    if (!errored) {
      return { status: 'none' };
    }
  }
};

const syncSessionAtom = (
  authClient: ConvexAuthProviderClient,
  sessionData: unknown
) => {
  const sessionAtom = authClient.$store?.atoms?.session as
    | AuthSessionAtom
    | undefined;
  if (
    typeof sessionAtom?.get !== 'function' ||
    typeof sessionAtom.set !== 'function'
  ) {
    return;
  }

  const current = sessionAtom.get();
  sessionAtom.set({
    data: sessionData,
    error: null,
    isPending: false,
    isRefetching: false,
    refetch: current?.refetch ?? (async () => {}),
  });
};

const clearSessionAtom = (authClient: ConvexAuthProviderClient) => {
  const sessionAtom = authClient.$store?.atoms?.session as
    | AuthSessionAtom
    | undefined;
  if (
    typeof sessionAtom?.get !== 'function' ||
    typeof sessionAtom.set !== 'function'
  ) {
    return;
  }

  const current = sessionAtom.get();
  sessionAtom.set({
    data: null,
    error: null,
    isPending: false,
    isRefetching: false,
    refetch: current?.refetch ?? (async () => {}),
  });
};

/**
 * Unified auth provider for Convex + Better Auth.
 * Handles token sync, HMR persistence, and auth callbacks.
 *
 * Structure: AuthProvider wraps ConvexAuthProviderInner so that
 * useAuthStore() is available when creating fetchAccessToken.
 */
export function ConvexAuthProvider({
  children,
  client,
  authClient,
  convexQueryClient,
  initialToken,
  onMutationUnauthorized,
  onQueryUnauthorized,
  isUnauthorized,
  optimisticAuth = false,
  onTokenIdentityChange,
  onTokenIdentityAdmitted,
  tokenIdentityBaseline,
}: ConvexAuthProviderProps) {
  // Handle cross-domain one-time token
  useOTTHandler(authClient);
  // With optimisticAuth, record the client's auth results where Convex
  // reports them, before this provider hands it a fetcher. Without it the
  // client is left untouched. Idempotent per client: never wrapped twice.
  useMemo(() => {
    if (optimisticAuth) watchClientSettlement(client);
  }, [client, optimisticAuth]);

  // With the identity guard, the SSR token is admitted before it is
  // published: a token for another identity never enters the store, never
  // opens the optimistic gate and trips the guard once mounted. The store
  // hydrates from these values once, so the decision is taken once too.
  // A provider mounted after the document tripped starts tripped: it
  // publishes no token and never opens the gate, whatever its client.
  const [inheritedTrip] = useState(isDocumentTripped);
  const [refusedInitialToken] = useState(
    () =>
      !inheritedTrip &&
      onTokenIdentityChange !== undefined &&
      !!initialToken &&
      refusesHeldToken(
        initialToken,
        resolveIdentityBaseline(tokenIdentityBaseline)
      )
  );

  // Memoize decoded JWT to avoid re-parsing on every render
  const tokenValues = useMemo(
    () =>
      refusedInitialToken || inheritedTrip
        ? { expiresAt: null, token: null }
        : {
            expiresAt: initialToken ? decodeJwtExp(initialToken) : null,
            token: initialToken ?? null,
          },
    [initialToken, inheritedTrip, refusedInitialToken]
  );

  // AuthProvider wraps inner so useAuthStore() is available inside
  // SSR initial values: set token/expiresAt, keep isLoading=true until Convex validates
  return (
    <AuthProvider
      initialValues={tokenValues}
      isUnauthorized={isUnauthorized ?? defaultIsUnauthorized}
      onMutationUnauthorized={onMutationUnauthorized ?? defaultMutationHandler}
      onQueryUnauthorized={onQueryUnauthorized ?? (() => {})}
    >
      <ConvexAuthProviderInner
        authClient={authClient}
        client={client}
        convexQueryClient={convexQueryClient}
        inheritedTrip={inheritedTrip}
        onTokenIdentityAdmitted={onTokenIdentityAdmitted}
        onTokenIdentityChange={onTokenIdentityChange}
        optimisticAuth={optimisticAuth}
        refusedInitialToken={refusedInitialToken}
        tokenIdentityBaseline={tokenIdentityBaseline}
      >
        {children}
      </ConvexAuthProviderInner>
    </AuthProvider>
  );
}

/**
 * Inner provider that has access to AuthStore via useAuthStore().
 * Creates fetchAccessToken and passes it through context (no race condition).
 */
function ConvexAuthProviderInner({
  children,
  client,
  authClient,
  convexQueryClient,
  inheritedTrip,
  optimisticAuth,
  onTokenIdentityChange,
  onTokenIdentityAdmitted,
  refusedInitialToken,
  tokenIdentityBaseline,
}: {
  children: ReactNode;
  client: ConvexReactClient;
  authClient: ConvexAuthProviderClient;
  convexQueryClient?: ConvexAuthProviderQueryClient;
  inheritedTrip: boolean;
  optimisticAuth: boolean;
  onTokenIdentityChange?: () => void;
  onTokenIdentityAdmitted?: (token: string) => void;
  refusedInitialToken: boolean;
  tokenIdentityBaseline?: ConvexAuthProviderProps['tokenIdentityBaseline'];
}) {
  const authStore = useAuthStore();
  convexQueryClient?.updateAuthStore(authStore);

  const { data: session, isPending } = authClient.useSession();

  // Use refs to avoid recreating fetchAccessToken on session refetch (tab focus)
  // This prevents Convex SDK from calling setAuth() again and causing race conditions
  const sessionRef = useRef(session);
  const isPendingRef = useRef(isPending);
  const pendingTokenRef = useRef<Promise<string | null> | null>(null);
  const restoredTokenRef = useRef<string | null>(null);
  const isMountedRef = useRef(false);
  sessionRef.current = session;
  isPendingRef.current = isPending;

  const getCachedJwt = useCallback(
    (minTimeRemainingMs = 0) => {
      const cachedToken = authStore.get('token');
      if (!cachedToken) {
        return null;
      }

      const expiresAt = decodeJwtExp(cachedToken);
      if (expiresAt === null || expiresAt <= Date.now() + minTimeRemainingMs) {
        return null;
      }

      return cachedToken;
    },
    [authStore]
  );

  // Clear token when session becomes null (logout)
  // This can't be inside fetchAccessToken because it's not called after logout
  useEffect(() => {
    if (hasActiveSessionData(session)) {
      authStore.set('sessionSyncGraceUntil', null);
      return;
    }

    if (
      !isPending &&
      !isSessionSyncGraceActive(authStore.get('sessionSyncGraceUntil'))
    ) {
      authStore.set('token', null);
      authStore.set('expiresAt', null);
      authStore.set('isAuthenticated', false);
      authStore.set('sessionSyncGraceUntil', null);
    }
  }, [session, isPending, authStore]);

  // The identity guard (`onTokenIdentityChange`): seeded from the baseline
  // the app hands a remount, else from the token the document already holds
  // when it mounts (the SSR token, admitted before it was published). A
  // getter baseline is re-read at every admission through a ref, so it always
  // sees the latest prop.
  const onTokenIdentityChangeRef = useRef(onTokenIdentityChange);
  onTokenIdentityChangeRef.current = onTokenIdentityChange;
  const onTokenIdentityAdmittedRef = useRef(onTokenIdentityAdmitted);
  onTokenIdentityAdmittedRef.current = onTokenIdentityAdmitted;
  const tokenIdentityBaselineRef = useRef(tokenIdentityBaseline);
  tokenIdentityBaselineRef.current = tokenIdentityBaseline;
  const identityGuardRef = useRef<IdentityGuard | null>(null);
  identityGuardRef.current ??= {
    identity:
      resolveIdentityBaseline(tokenIdentityBaseline) ??
      decodeTokenIdentity(authStore.get('token')),
    baseline:
      typeof tokenIdentityBaseline === 'function'
        ? () => resolveIdentityBaseline(tokenIdentityBaselineRef.current)
        : null,
    tripped: refusedInitialToken || inheritedTrip,
    // An inherited trip already ran its side effects (close, callback).
    tripSettled: inheritedTrip,
  };
  // The identity this guard already knows (baseline or held SSR token)
  // becomes the page's at mount, before any fetch, so a token handed out
  // outside a provider (the Start loader) is held to it too.
  if (onTokenIdentityChange && identityGuardRef.current.identity) {
    recordDocumentIdentity(identityGuardRef.current.identity);
  }
  const [guardTripped, setGuardTripped] = useState(
    refusedInitialToken || inheritedTrip
  );
  // A fresh token announced when it was admitted, so its hand-out does not
  // announce it a second time.
  const announcedTokenRef = useRef<string | null>(null);

  // A tripped document is terminal for this provider: nothing is handed out
  // any more, and the store publishes unauthenticated (which clears
  // auth-bound queries, see CRPCProviderInner).
  const quarantine = useCallback(() => {
    identityGuardRef.current!.tripped = true;
    authStore.set('token', null);
    authStore.set('expiresAt', null);
    authStore.set('sessionSyncGraceUntil', null);
    authStore.set('isAuthenticated', false);
    authStore.set('isLoading', false);
    setGuardTripped(true);
  }, [authStore]);

  // The provider whose guard refused a token trips the document, closes its
  // client and then runs the app's callback, so a throwing callback cannot
  // keep the old client alive.
  const tripGuard = useCallback(() => {
    const guard = identityGuardRef.current!;
    guard.tripped = true;
    if (guard.tripSettled) return;
    guard.tripSettled = true;
    quarantine();
    tripDocument();
    if (!onTokenIdentityChangeRef.current) return;
    try {
      void Promise.resolve(client.close()).catch(() => {});
    } catch {
      // A client that cannot close is still never handed a token again.
    }
    try {
      onTokenIdentityChangeRef.current?.();
    } catch (error) {
      console.error('[ConvexAuthProvider] onTokenIdentityChange threw', error);
    }
  }, [client, quarantine]);

  useEffect(() => {
    if (refusedInitialToken) tripGuard();
  }, [refusedInitialToken, tripGuard]);

  // A trip anywhere in the page (another provider, the Start loader) runs the
  // same steps here once: quarantine, and with `onTokenIdentityChange`, close
  // this provider's client and call it. A provider mounted after the trip
  // starts tripped and calls nothing.
  useEffect(() => {
    if (isDocumentTripped()) tripGuard();
    return subscribeDocumentTrip(tripGuard);
  }, [tripGuard]);

  // This provider's identity admission, which the token gate applies to
  // every token cached, published or handed out for this store (the
  // provider's own fetcher, restores, and auth mutations alike). `announce`:
  // whether `onTokenIdentityAdmitted` hears this admission. A fresh token is
  // admitted and announced in the same step that caches it; its hand-out
  // checks it again without announcing it twice.
  const admitIdentity = useCallback<TokenAdmission>(
    (token, { announce }) => {
      if (!onTokenIdentityChangeRef.current) return true;
      const guard = identityGuardRef.current!;
      if (guard.tripped) return false;
      if (admitTokenIdentity(guard, token)) {
        if (guard.identity) recordDocumentIdentity(guard.identity);
        if (announce) onTokenIdentityAdmittedRef.current?.(token);
        return true;
      }
      tripGuard();
      return false;
    },
    [tripGuard]
  );
  // Registered during render so it is in place before any effect or
  // mutation publishes a token; re-registering is idempotent.
  registerTokenAdmission(authStore, admitIdentity);

  // Whether a held token may open the optimistic gate: never after a trip,
  // never for a token the guard would refuse.
  const canOpenGate = useCallback((token: string) => {
    if (!onTokenIdentityChangeRef.current) return true;
    const guard = identityGuardRef.current!;
    return !guard.tripped && judgeTokenIdentity(guard, token) !== null;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasActiveSessionData(session) || isPending || authStore.get('token')) {
      return;
    }
    const persistedToken = readAuthSessionFallbackToken();
    // An opaque session token proves no identity before it is used, so with
    // the identity guard it is not restored while an identity is
    // established. A persisted JWT goes through the token gate below.
    if (
      onTokenIdentityChangeRef.current &&
      persistedToken &&
      decodeJwtExp(persistedToken) === null &&
      guardHasIdentity(identityGuardRef.current!)
    ) {
      return;
    }
    if (
      !persistedToken ||
      // The restore owns the optimistic state until it resolves. Re-entering on
      // an unrelated re-render would either duplicate the probe or orphan the
      // one already in flight.
      restoredTokenRef.current === persistedToken ||
      (typeof authClient.getSession !== 'function' &&
        typeof (authClient as AuthClientFetch).$fetch !== 'function')
    ) {
      return;
    }

    restoredTokenRef.current = persistedToken;

    const persistedSessionData = readAuthSessionFallbackData();
    const graceUntil = Date.now() + AUTH_SESSION_SYNC_GRACE_MS;

    if (
      !publishToken(authStore, persistedToken, {
        announce: true,
        sessionSyncGraceUntil: graceUntil,
      })
    ) {
      return;
    }
    if (persistedSessionData) {
      syncSessionAtom(authClient, persistedSessionData);
    }

    // Anything else that takes over the token — a Convex JWT exchange, a sign
    // out — owns the state from that point on, so the restore stands down.
    const ownsToken = () => authStore.get('token') === persistedToken;
    const shouldStop = () => !isMountedRef.current || !ownsToken();

    void getSessionFromPersistedToken(
      authClient as AuthClientFetch,
      persistedToken,
      { deadline: graceUntil, shouldStop }
    )
      .then((outcome) => {
        const hasCompetingSession =
          hasActiveSessionData(sessionRef.current) &&
          !isSameSession(sessionRef.current, persistedSessionData);
        if (!isMountedRef.current || !ownsToken() || hasCompetingSession) {
          return;
        }

        if (outcome.status === 'session') {
          syncSessionAtom(authClient, outcome.data);
          writeAuthSessionFallbackData(outcome.data);
          return;
        }

        // The transport never answered before the grace window closed. Keep the
        // persisted credential — a dropped request is not a sign out, and the
        // next mount can retry it — but drop the optimistic state this effect
        // created. Leaving it behind pins the app in `isLoading` forever.
        if (outcome.status === 'unknown') {
          if (persistedSessionData) {
            clearSessionAtom(authClient);
          }
          authStore.set('token', null);
          authStore.set('expiresAt', null);
          authStore.set('sessionSyncGraceUntil', null);
          return;
        }

        clearAuthSessionFallback();
        clearSessionAtom(authClient);
        authStore.set('token', null);
        authStore.set('expiresAt', null);
        authStore.set('sessionSyncGraceUntil', null);
      })
      // An unexpected failure is not evidence that the session is gone either.
      .catch(() => {});
  }, [session, isPending, authStore, authClient]);

  // Stable fetchAccessToken - only recreated when authStore/authClient change (rare)
  // Reads session/isPending from refs to avoid dependency on changing objects
  const fetchAccessToken = useCallback(
    async ({
      forceRefreshToken = false,
    }: {
      forceRefreshToken?: boolean;
    } = {}) => {
      const fetchFreshToken = () => {
        if (pendingTokenRef.current) {
          return pendingTokenRef.current;
        }

        const cachedToken = authStore.get('token');
        const fetchOptions: {
          credentials?: 'omit';
          headers?: {
            Authorization: string;
          };
          throw: false;
        } = {
          throw: false,
        };
        if (cachedToken && decodeJwtExp(cachedToken) === null) {
          fetchOptions.credentials = 'omit';
          fetchOptions.headers = {
            Authorization: `Bearer ${cachedToken}`,
          };
        }

        // biome-ignore lint/suspicious/noExplicitAny: convex plugin type
        pendingTokenRef.current = (authClient as any).convex
          .token({ fetchOptions })
          .then((result: { data?: { token?: string | null } | null }) => {
            const jwt = result.data?.token || null;
            // Admitted (and announced) in the same step that caches it, so a
            // token for another identity is never published.
            if (jwt) {
              if (
                !publishToken(authStore, jwt, {
                  announce: true,
                  sessionSyncGraceUntil: null,
                })
              ) {
                return null;
              }
              announcedTokenRef.current = jwt;
              return jwt;
            }

            const cachedJwt = getCachedJwt();
            if (cachedJwt) {
              authStore.set('expiresAt', decodeJwtExp(cachedJwt));
              authStore.set('sessionSyncGraceUntil', null);
              return cachedJwt;
            }

            authStore.set('token', null);
            authStore.set('expiresAt', null);
            authStore.set('sessionSyncGraceUntil', null);
            return null;
          })
          .catch((error: unknown) => {
            const cachedJwt = getCachedJwt();
            if (cachedJwt) {
              authStore.set('expiresAt', decodeJwtExp(cachedJwt));
              authStore.set('sessionSyncGraceUntil', null);
              return cachedJwt;
            }

            authStore.set('token', null);
            authStore.set('expiresAt', null);
            authStore.set('sessionSyncGraceUntil', null);
            console.error('[fetchAccessToken] error', error);
            return null;
          })
          .finally(() => {
            pendingTokenRef.current = null;
          });

        return pendingTokenRef.current;
      };

      const fetchFreshTokenForced = async () => {
        // For forced refresh, if we only have an in-flight request and it
        // resolves null, retry once immediately instead of returning null.
        const cachedJwt = getCachedJwt();
        if (pendingTokenRef.current) {
          const token = await pendingTokenRef.current;
          if (token && (!cachedJwt || token !== cachedJwt)) {
            return token;
          }
        }

        return fetchFreshToken();
      };

      const currentSession = sessionRef.current;
      const currentIsPending = isPendingRef.current;
      const hasSession = hasActiveSessionData(currentSession);
      const hasSessionSyncGrace = isSessionSyncGraceActive(
        authStore.get('sessionSyncGraceUntil')
      );

      // If no session:
      // - If still pending (hydration), return cached SSR token for non-forced reads
      // - If the cached token is an opaque Better Auth session token, exchange it
      //   before handing auth to Convex
      // - If still pending + forced refresh, fetch a fresh token for Convex scheduling
      // - If not pending (confirmed no session), clear cache
      if (!hasSession) {
        if (currentIsPending || hasSessionSyncGrace) {
          const cachedJwt = getCachedJwt();

          if (!forceRefreshToken) {
            if (cachedJwt) {
              return cachedJwt;
            }

            return fetchFreshToken();
          }

          const freshToken = await fetchFreshTokenForced();

          // During hydration, keep a cached JWT on transient forced-refresh failure.
          // Convex asked for a fresh token, but dropping auth to null here can
          // briefly flip to unauthenticated before Better Auth session settles.
          // The write-back goes through the token gate like any other.
          if (!freshToken && cachedJwt) {
            return publishToken(authStore, cachedJwt, { announce: false })
              ? cachedJwt
              : null;
          }

          return freshToken;
        }

        authStore.set('token', null);
        authStore.set('expiresAt', null);
        authStore.set('sessionSyncGraceUntil', null);
        return null;
      }

      // Check cached JWT from store
      const cachedToken = authStore.get('token');
      const expiresAt = authStore.get('expiresAt');
      const timeRemaining = expiresAt ? expiresAt - Date.now() : 0;

      // Return cached if valid and not forced (60s leeway)
      if (
        !forceRefreshToken &&
        cachedToken &&
        expiresAt &&
        timeRemaining >= 60_000
      ) {
        return cachedToken;
      }

      if (!forceRefreshToken && pendingTokenRef.current) {
        return pendingTokenRef.current;
      }

      if (forceRefreshToken) {
        return fetchFreshTokenForced();
      }

      return fetchFreshToken();
    },
    // Stable deps - authStore/authClient rarely change
    // session/isPending accessed via refs to prevent callback recreation
    [authStore, authClient, getCachedJwt]
  );

  // Every token consumer (Convex, HTTP headers) goes through this. No
  // request starts after a trip, and the token gate decides at hand-out,
  // after every await, so a trip meanwhile anywhere in the document wins.
  const guardedFetchAccessToken = useCallback(
    async (args: { forceRefreshToken?: boolean } = {}) => {
      if (isDocumentTripped()) return null;
      const token = await fetchAccessToken(args);
      if (!token) return null;
      const announced = announcedTokenRef.current === token;
      if (announced) announcedTokenRef.current = null;
      return admitToken(authStore, token, { announce: !announced })
        ? token
        : null;
    },
    [authStore, fetchAccessToken]
  );

  // Create useAuth hook for ConvexProviderWithAuth
  // The hook itself is stable - it reads current values from refs
  // This prevents Convex SDK from calling setAuth() on every session refetch
  const useAuth = useCallback(
    function useConvexAuthHook() {
      const token = authStore.get('token');
      const hasSession = hasActiveSessionData(sessionRef.current);
      const sessionMissing = !hasSession && !isPendingRef.current;
      return {
        isLoading: isPendingRef.current && !token,
        // If Better Auth confirms no session, stale JWT should not keep auth=true.
        isAuthenticated: sessionMissing ? false : hasSession || token !== null,
        fetchAccessToken: guardedFetchAccessToken,
      };
    },
    [guardedFetchAccessToken, authStore]
  );

  return (
    <FetchAccessTokenContext.Provider value={guardedFetchAccessToken}>
      <ConvexProviderWithAuth
        client={client as IConvexReactClient}
        useAuth={useAuth}
      >
        <AuthStateSync
          canOpenGate={canOpenGate}
          client={client}
          guardTripped={guardTripped}
          optimisticAuth={optimisticAuth}
        >
          {children}
        </AuthStateSync>
      </ConvexProviderWithAuth>
    </FetchAccessTokenContext.Provider>
  );
}

/**
 * Syncs auth state from useConvexAuth() to the auth store.
 * MUST be inside ConvexProviderWithAuth to access useConvexAuth().
 *
 * Defensive isLoading computation handles SSR hydration race:
 * 1. SSR sets token from cookie
 * 2. Client hydrates
 * 3. Better Auth's useSession() briefly returns null before loading cookie
 * 4. Convex sets isConvexAuthenticated = false (no auth to wait for)
 * 5. Without defensive check, we'd sync { isLoading: false, isAuthenticated: false }
 * 6. Queries would throw UNAUTHORIZED before token is validated
 */
function AuthStateSync({
  canOpenGate,
  children,
  client,
  guardTripped,
  optimisticAuth = false,
}: {
  canOpenGate: (token: string) => boolean;
  children: ReactNode;
  client: ConvexReactClient;
  guardTripped: boolean;
  optimisticAuth?: boolean;
}) {
  const { isLoading: convexIsLoading, isAuthenticated } = useConvexAuth();
  const authStore = useAuthStore();
  const token = useAuthValue('token');
  // Whether the client has reported an auth result, to any provider.
  const subscribe = useCallback(
    (listener: () => void) => subscribeClientSettlement(client, listener),
    [client]
  );
  const getSettled = useCallback(() => isClientSettled(client), [client]);
  const settled = useSyncExternalStore(subscribe, getSettled, getSettled);

  useEffect(() => {
    // Read the trip and the settlement again at the write: a descendant
    // effect earlier in this commit may have changed either.
    const gate = resolveAuthGate({
      canOpenGate,
      convexIsLoading,
      guardTripped: guardTripped || isDocumentTripped(),
      isAuthenticated,
      optimisticWindow: optimisticAuth && !settled && !isClientSettled(client),
      token,
    });

    publishAuthState(authStore, gate);
  }, [
    canOpenGate,
    client,
    convexIsLoading,
    guardTripped,
    isAuthenticated,
    optimisticAuth,
    settled,
    token,
    authStore,
  ]);

  return children;
}

type IdentityGuard = {
  identity: string | null;
  /** The document's current identity, when the baseline is a getter. */
  baseline: (() => string | null) | null;
  tripped: boolean;
  /** Whether the trip's side effects (store, close, callback) have run. */
  tripSettled: boolean;
};

/** Whether the guard already speaks for an identity (its own or the document's). */
function guardHasIdentity(guard: IdentityGuard): boolean {
  return guard.identity !== null || (guard.baseline?.() ?? null) !== null;
}

/**
 * The identity a token is admitted under, `''` for a token that carries none
 * while no identity is established yet, or null when it is refused. A token
 * without a decodable identity cannot prove it is the established one.
 */
function judgeTokenIdentity(
  guard: IdentityGuard,
  token: string
): string | null {
  const identity = decodeTokenIdentity(token);
  const current = guard.baseline ? guard.baseline() : null;
  if (identity === null) {
    return guard.identity === null && current === null ? '' : null;
  }
  const matchesGuard = guard.identity === null || guard.identity === identity;
  const matchesDocument = current === null || current === identity;
  return matchesGuard && matchesDocument ? identity : null;
}

/**
 * A held SSR token is refused when it is a JWT that does not prove the
 * established identity. An opaque session token is only an exchange
 * credential: the JWT it is exchanged for is admitted before it is used.
 */
function refusesHeldToken(token: string, established: string | null) {
  if (decodeJwtExp(token) === null || established === null) return false;
  return decodeTokenIdentity(token) !== established;
}

/**
 * `tokenIdentityBaseline` as given: a fixed identity, or a getter for the
 * document's current one.
 */
function resolveIdentityBaseline(
  baseline: string | null | (() => string | null) | undefined
): string | null {
  return typeof baseline === 'function' ? baseline() : (baseline ?? null);
}

/**
 * With `onTokenIdentityChange`, a document speaks for one identity (JWT `sub`
 * and `sessionId`) for its lifetime: `tokenIdentityBaseline` when given (a
 * provider that remounts within one document), else the one it already holds
 * when it mounts (the SSR token), or, for a document with none, the first
 * token that carries one. Given as a getter, the document's current identity
 * is read at every admission, cached tokens included: a token must match both
 * it and the identity this guard already admitted, so a provider kept
 * mounted but hidden (React `<Activity>`) cannot resume under an identity the
 * document has since moved away from. Once an identity is established, a
 * token without one is refused. A refused token is never cached or handed
 * out; the caller trips the guard. Returns whether the token is admitted.
 */
function admitTokenIdentity(guard: IdentityGuard, token: string): boolean {
  const identity = judgeTokenIdentity(guard, token);
  if (identity === null) return false;
  if (identity !== '') guard.identity = identity;
  return true;
}

type AuthGateInput = {
  canOpenGate: (token: string) => boolean;
  convexIsLoading: boolean;
  guardTripped: boolean;
  isAuthenticated: boolean;
  /** `optimisticAuth`, while the client has not reported an auth result. */
  optimisticWindow: boolean;
  token: string | null;
};

/**
 * The auth state published to the store, which is what every query gate reads.
 *
 * Without `optimisticAuth` this is the confirmed state: queries wait until
 * Convex has confirmed the token. With it, until the Convex client reports its
 * first auth result, a held, unexpired JWT counts as authenticated while
 * Convex confirms it, so auth-bound queries subscribe at once; Convex sends
 * them after Authenticate on the same socket, and a refused token closes the
 * socket before any of them is evaluated. When Convex refuses the token,
 * `isAuthenticated` falls back to false, which resets auth-bound queries (see
 * `CRPCProviderInner`), and the window is over: no token reopens it.
 */
function resolveAuthGate({
  canOpenGate,
  convexIsLoading,
  guardTripped,
  isAuthenticated,
  optimisticWindow,
  token,
}: AuthGateInput): { isAuthenticated: boolean; isLoading: boolean } {
  // A tripped identity guard is terminal: unauthenticated, whatever Convex says.
  if (guardTripped) {
    return { isAuthenticated: false, isLoading: false };
  }
  if (
    optimisticWindow &&
    convexIsLoading &&
    token !== null &&
    isOptimisticToken(token) &&
    canOpenGate(token)
  ) {
    return { isAuthenticated: true, isLoading: false };
  }
  // DEFENSIVE: If we have a token but Convex says not authenticated,
  // stay in loading state to avoid UNAUTHORIZED errors during hydration
  return {
    isAuthenticated,
    isLoading: convexIsLoading || (!!token && !isAuthenticated),
  };
}

function isOptimisticToken(token: string) {
  const expiresAt = decodeJwtExp(token);
  return expiresAt !== null && expiresAt > Date.now();
}

/**
 * Handles cross-domain one-time token (OTT) verification.
 */
function useOTTHandler(authClient: ConvexAuthProviderClient) {
  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || !window.location?.href) {
        return;
      }
      const url = new URL(window.location.href);
      const token = url.searchParams.get('ott');

      if (token) {
        // biome-ignore lint/suspicious/noExplicitAny: cross-domain plugin type
        const authClientWithCrossDomain = authClient as any;
        url.searchParams.delete('ott');
        window.history.replaceState({}, '', url);
        const result =
          await authClientWithCrossDomain.crossDomain.oneTimeToken.verify({
            token,
          });
        const session = result.data?.session;

        if (session && typeof authClient.getSession === 'function') {
          const getSession = authClient.getSession as AuthGetSession;
          await getSession({
            fetchOptions: {
              credentials: 'omit',
              headers: {
                Authorization: `Bearer ${session.token}`,
              },
            },
          });
          authClientWithCrossDomain.updateSession();
        }
      }
    })();
  }, [authClient]);
}
