import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { writeAuthSessionFallbackToken } from '../react/auth-session-fallback';
import type { AuthStore } from '../react/auth-store';
import {
  decodeJwtExp,
  useAuth,
  useAuthStore,
  useConvexAuthRecovery,
  useFetchAccessToken,
} from '../react/auth-store';
import { ConvexAuthProvider } from './convex-auth-provider';

const makeJwt = (expSecondsFromNow: number) => {
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  const payload = btoa(JSON.stringify({ exp }));
  return `x.${payload}.z`;
};

// Fake timers move Date.now() too, so the grace window closes without the test
// spending ten real seconds on it. Stepping a second at a time lets React flush
// between the awaited backoff and the next probe.
const advanceSeconds = async (seconds: number) => {
  for (let step = 0; step < seconds; step += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
  }
};

describe('ConvexAuthProvider', () => {
  let originalHref = window.location.href;

  beforeEach(() => {
    originalHref = window.location.href;
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    try {
      window.history.replaceState({}, '', originalHref);
    } catch {
      // Happy DOM may reject some URL transitions; don't let cleanup fail the suite.
    }
  });

  test('recovers Better Auth after a transient token refresh failure', async () => {
    const bindings: Array<{
      fetchToken: (args: {
        forceRefreshToken: boolean;
      }) => Promise<string | null>;
      onChange: (isAuthenticated: boolean) => void;
    }> = [];
    const client = {
      clearAuth: mock(() => {}),
      setAuth: mock(
        (
          fetchToken: (args: {
            forceRefreshToken: boolean;
          }) => Promise<string | null>,
          onChange: (isAuthenticated: boolean) => void
        ) => {
          bindings.push({ fetchToken, onChange });
        }
      ),
    };
    const recoveredToken = makeJwt(7200);
    const token = mock()
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { token: recoveredToken } });
    const authClient = {
      useSession: () => ({
        data: { session: { id: 'session-1' } },
        isPending: false,
      }),
      convex: { token },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    let recovery: ReturnType<typeof useConvexAuthRecovery> | undefined;
    expect(() => {
      renderHook(
        () => {
          recovery = useConvexAuthRecovery();
        },
        { wrapper }
      );
    }).not.toThrow();

    await waitFor(() => {
      expect(bindings).toHaveLength(1);
    });
    let failedToken: string | null = null;
    await act(async () => {
      failedToken = await bindings[0]!.fetchToken({
        forceRefreshToken: true,
      });
    });
    expect(failedToken).toBeNull();
    act(() => {
      bindings[0]!.onChange(false);
    });

    let recovered!: Promise<void>;
    act(() => {
      recovered = recovery!.recover({ timeoutMs: 1_000 });
    });
    await waitFor(() => {
      expect(bindings).toHaveLength(2);
    });
    let freshToken: string | null = null;
    await act(async () => {
      freshToken = await bindings[1]!.fetchToken({
        forceRefreshToken: false,
      });
    });
    expect(freshToken).toBe(recoveredToken);
    act(() => {
      bindings[1]!.onChange(true);
    });

    await expect(recovered).resolves.toBeUndefined();
    expect(token).toHaveBeenCalledTimes(2);
  });

  test('syncs ConvexQueryClient with the auth store before children render', () => {
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const authClient = {
      useSession: () => ({ data: null, isPending: true }),
      convex: { token: mock(async () => ({ data: { token: makeJwt(7200) } })) },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: {
        oneTimeToken: {
          verify: async () => ({ data: {} }),
        },
      },
    };

    let syncedStore: ReturnType<typeof useAuthStore> | undefined;
    const convexQueryClient = {
      updateAuthStore: mock((authStore: ReturnType<typeof useAuthStore>) => {
        syncedStore = authStore;
      }),
    };

    function StoreProbe() {
      const authStore = useAuthStore();
      expect(syncedStore?.store).toBe(authStore.store);
      return null;
    }

    render(
      <ConvexAuthProvider
        authClient={authClient as any}
        client={client as any}
        convexQueryClient={convexQueryClient}
      >
        <StoreProbe />
      </ConvexAuthProvider>
    );

    expect(convexQueryClient.updateAuthStore).toHaveBeenCalled();
  });

  test('provides fetchAccessToken that returns cached SSR token while session is pending', async () => {
    const initialToken = makeJwt(3600);

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const convexToken = mock(async () => ({ data: { token: makeJwt(7200) } }));

    const authClient = {
      useSession: () => ({ data: null, isPending: true }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: {
        oneTimeToken: {
          verify: async () => ({ data: {} }),
        },
      },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider
        authClient={authClient as any}
        client={client as any}
        initialToken={initialToken}
      >
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useFetchAccessToken(), { wrapper });
    expect(typeof result.current).toBe('function');

    let fetched: string | null = null;
    await act(async () => {
      fetched = await result.current!({ forceRefreshToken: false });
    });

    // Assignment happens inside `act` callback; widen back to the declared union.
    expect(fetched as string | null).toBe(initialToken);
    expect(convexToken).toHaveBeenCalledTimes(0);
  });

  test('fetches a fresh token when forceRefreshToken=true while session is pending', async () => {
    const initialToken = makeJwt(3600);
    const freshToken = makeJwt(7200);

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const convexToken = mock(async () => ({ data: { token: freshToken } }));

    const authClient = {
      useSession: () => ({ data: null, isPending: true }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: {
        oneTimeToken: {
          verify: async () => ({ data: {} }),
        },
      },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider
        authClient={authClient as any}
        client={client as any}
        initialToken={initialToken}
      >
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useFetchAccessToken(), { wrapper });
    expect(typeof result.current).toBe('function');

    let fetched: string | null = null;
    await act(async () => {
      fetched = await result.current!({ forceRefreshToken: true });
    });

    expect(fetched as string | null).toBe(freshToken);
    expect(convexToken).toHaveBeenCalledTimes(1);
    expect(convexToken).toHaveBeenCalledWith({
      fetchOptions: { throw: false },
    });
  });

  test('falls back to SSR token when forced refresh fails while session is pending', async () => {
    const initialToken = makeJwt(3600);

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const convexToken = mock(async () => ({ data: {} }));

    const authClient = {
      useSession: () => ({ data: null, isPending: true }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: {
        oneTimeToken: {
          verify: async () => ({ data: {} }),
        },
      },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider
        authClient={authClient as any}
        client={client as any}
        initialToken={initialToken}
      >
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useFetchAccessToken(), { wrapper });
    expect(typeof result.current).toBe('function');

    let forcedFetched: string | null = null;
    await act(async () => {
      forcedFetched = await result.current!({ forceRefreshToken: true });
    });

    let nonForcedFetched: string | null = null;
    await act(async () => {
      nonForcedFetched = await result.current!({ forceRefreshToken: false });
    });

    expect(forcedFetched as string | null).toBe(initialToken);
    expect(nonForcedFetched as string | null).toBe(initialToken);
    expect(convexToken).toHaveBeenCalledTimes(1);
    expect(convexToken).toHaveBeenCalledWith({
      fetchOptions: { throw: false },
    });
  });

  test('retries forced refresh when pending in-flight refresh resolves null', async () => {
    const initialToken = makeJwt(3600);
    const freshToken = makeJwt(7200);

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    let callCount = 0;
    let resolveFirstCallGate!: () => void;
    const firstCallGate = new Promise<void>((resolve) => {
      resolveFirstCallGate = resolve;
    });

    const convexToken = mock(async () => {
      callCount += 1;
      if (callCount === 1) {
        await firstCallGate;
        return { data: {} };
      }
      return { data: { token: freshToken } };
    });

    const authClient = {
      useSession: () => ({ data: null, isPending: true }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: {
        oneTimeToken: {
          verify: async () => ({ data: {} }),
        },
      },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider
        authClient={authClient as any}
        client={client as any}
        initialToken={initialToken}
      >
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useFetchAccessToken(), { wrapper });
    expect(typeof result.current).toBe('function');

    const firstForcedPromise = result.current!({ forceRefreshToken: true });
    await Promise.resolve();
    const secondForcedPromise = result.current!({ forceRefreshToken: true });

    resolveFirstCallGate();

    let firstResult: string | null = null;
    let secondResult: string | null = null;
    await act(async () => {
      firstResult = await firstForcedPromise;
      secondResult = await secondForcedPromise;
    });

    expect(firstResult as string | null).toBe(initialToken);
    expect(secondResult as string | null).toBe(freshToken);
    expect(convexToken).toHaveBeenCalledTimes(2);
  });

  test('passes throw=false when fetching a fresh token', async () => {
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const jwt = makeJwt(7200);
    const convexToken = mock(async (_opts?: unknown) => ({
      data: { token: jwt },
    }));

    const authClient = {
      useSession: () => ({
        data: { session: { id: 'session-1' } },
        isPending: false,
      }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useFetchAccessToken(), { wrapper });
    expect(typeof result.current).toBe('function');

    await act(async () => {
      const fetched = await result.current!({ forceRefreshToken: true });
      expect(fetched).toBe(jwt);
    });

    expect(convexToken).toHaveBeenCalledTimes(1);
    expect(convexToken).toHaveBeenCalledWith({
      fetchOptions: { throw: false },
    });
  });

  test('passes the cached session token as bearer auth when it is not a JWT', async () => {
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const convexJwt = makeJwt(7200);
    const convexToken = mock(async (_opts?: unknown) => ({
      data: { token: convexJwt },
    }));

    const authClient = {
      useSession: () => ({
        data: { session: { id: 'session-1' } },
        isPending: false,
      }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(
      () => ({
        fetchAccessToken: useFetchAccessToken(),
        store: useAuthStore(),
      }),
      { wrapper }
    );

    await act(async () => {
      result.current.store.set('token', 'session-token');
      result.current.store.set('expiresAt', null);
    });

    let fetched: string | null = null;
    await act(async () => {
      fetched = await result.current.fetchAccessToken!({
        forceRefreshToken: true,
      });
    });

    expect(fetched as string | null).toBe(convexJwt);
    expect(convexToken).toHaveBeenCalledTimes(1);
    expect(convexToken).toHaveBeenCalledWith({
      fetchOptions: {
        credentials: 'omit',
        headers: {
          Authorization: 'Bearer session-token',
        },
        throw: false,
      },
    });
  });

  test('rehydrates auth from a persisted session token fallback on reload', async () => {
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const sessionAtomState = {
      data: null as unknown,
      error: null as unknown,
      isPending: false,
      isRefetching: false,
      refetch: async () => {},
    };
    const sessionAtom = {
      get: () => sessionAtomState,
      set: mock((value: typeof sessionAtomState) => {
        sessionAtomState.data = value.data;
        sessionAtomState.error = value.error;
        sessionAtomState.isPending = value.isPending;
        sessionAtomState.isRefetching = value.isRefetching;
        sessionAtomState.refetch = value.refetch;
      }),
    };

    const authFetch = mock(async () => ({
      data: {
        session: { id: 'session-1' },
        user: { email: 'persisted@example.com' },
      },
    }));

    const authClient = {
      $store: { atoms: { session: sessionAtom } },
      useSession: () => ({ data: null, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: makeJwt(7200) } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    renderHook(
      () => ({
        auth: useAuth(),
        fetchAccessToken: useFetchAccessToken(),
        store: useAuthStore(),
      }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(authFetch).toHaveBeenCalledWith('/get-session', {
      credentials: 'omit',
      headers: {
        Authorization: 'Bearer persisted-session-token',
      },
    });
    // A live token costs exactly one immediate request, with no pre-delay.
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  test('clears seeded session atom when persisted token recheck fails', async () => {
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );
    window.sessionStorage.setItem(
      'kitcn.auth.session-data',
      JSON.stringify({
        session: { id: 'session-1' },
        user: { email: 'persisted@example.com' },
      })
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const sessionAtomState = {
      data: null as unknown,
      error: null as unknown,
      isPending: false,
      isRefetching: false,
      refetch: async () => {},
    };
    const sessionAtom = {
      get: () => sessionAtomState,
      set: mock((value: typeof sessionAtomState) => {
        sessionAtomState.data = value.data;
        sessionAtomState.error = value.error;
        sessionAtomState.isPending = value.isPending;
        sessionAtomState.isRefetching = value.isRefetching;
        sessionAtomState.refetch = value.refetch;
      }),
    };

    const authFetch = mock(async () => ({ data: null }));
    const authClient = {
      $store: { atoms: { session: sessionAtom } },
      useSession: () => ({ data: null, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: makeJwt(7200) } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(sessionAtomState.data).toBeNull();
    expect(
      window.sessionStorage.getItem('kitcn.auth.session-token')
    ).toBeNull();
    expect(window.sessionStorage.getItem('kitcn.auth.session-data')).toBeNull();
    // 200 with a null body is definitive: no retry storm.
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  test('keeps the persisted token when every session recheck fails in transport', async () => {
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );
    window.sessionStorage.setItem(
      'kitcn.auth.session-data',
      JSON.stringify({
        session: { id: 'session-1' },
        user: { email: 'persisted@example.com' },
      })
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const sessionAtomState = {
      data: null as unknown,
      error: null as unknown,
      isPending: false,
      isRefetching: false,
      refetch: async () => {},
    };
    const sessionAtom = {
      get: () => sessionAtomState,
      set: mock((value: typeof sessionAtomState) => {
        sessionAtomState.data = value.data;
        sessionAtomState.error = value.error;
        sessionAtomState.isPending = value.isPending;
        sessionAtomState.isRefetching = value.isRefetching;
        sessionAtomState.refetch = value.refetch;
      }),
    };

    const authFetch = mock(async () => ({
      data: null,
      error: { status: 0, statusText: 'Failed to fetch' },
    }));
    const authClient = {
      $store: { atoms: { session: sessionAtom } },
      useSession: () => ({ data: null, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: makeJwt(7200) } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });

    const token = window.sessionStorage.getItem('kitcn.auth.session-token');
    const data = window.sessionStorage.getItem('kitcn.auth.session-data');

    // A dropped request must not sign the user out.
    expect(token).toBe('persisted-session-token');
    expect(data).not.toBeNull();
    expect(authFetch).toHaveBeenCalledTimes(3);
  });

  test('resolves the auth state when the grace window closes with no answer', async () => {
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const authFetch = mock(async () => ({
      data: null,
      error: { status: 0, statusText: 'Failed to fetch' },
    }));
    const authClient = {
      useSession: () => ({ data: null, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: null } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    jest.useFakeTimers();
    let result: {
      current: { auth: ReturnType<typeof useAuth>; store: AuthStore };
    };
    try {
      result = renderHook(() => ({ auth: useAuth(), store: useAuthStore() }), {
        wrapper,
      }).result;

      // Well past AUTH_SESSION_SYNC_GRACE_MS.
      await advanceSeconds(40);
    } finally {
      jest.useRealTimers();
    }

    // The optimistic state the restore created must not outlive its own grace
    // window, or the app hangs on `isLoading` forever.
    expect(result.current.auth.isLoading).toBe(false);
    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(result.current.store.get('token')).toBeNull();
    expect(result.current.store.get('sessionSyncGraceUntil')).toBeNull();
    // The credential still survives, so the next mount can retry it.
    expect(window.sessionStorage.getItem('kitcn.auth.session-token')).toBe(
      'persisted-session-token'
    );
  });

  test('restores the session in the same mount when the transport recovers', async () => {
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const restored = {
      session: { id: 'session-1' },
      user: { email: 'persisted@example.com' },
    };
    let online = false;
    const authFetch = mock(async () =>
      online
        ? { data: restored }
        : { data: null, error: { status: 0, statusText: 'Failed to fetch' } }
    );
    const authClient = {
      useSession: () => ({ data: null, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: null } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    jest.useFakeTimers();
    let result: {
      current: { auth: ReturnType<typeof useAuth>; store: AuthStore };
    };
    try {
      result = renderHook(() => ({ auth: useAuth(), store: useAuthStore() }), {
        wrapper,
      }).result;

      await advanceSeconds(3);
      online = true;
      await advanceSeconds(4);
    } finally {
      jest.useRealTimers();
    }

    // Connectivity returned inside the window, so no remount is needed.
    expect(window.sessionStorage.getItem('kitcn.auth.session-data')).toBe(
      JSON.stringify(restored)
    );
    expect(result.current.store.get('token')).toBe('persisted-session-token');
  });

  test('stops the persisted-token recovery once a Convex JWT takes over', async () => {
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const authFetch = mock(async () => ({
      data: null,
      error: { status: 0, statusText: 'Failed to fetch' },
    }));
    const authClient = {
      useSession: () => ({ data: null, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: null } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    const jwt = makeJwt(7200);
    jest.useFakeTimers();
    let result: {
      current: { auth: ReturnType<typeof useAuth>; store: AuthStore };
    };
    let callsAtTakeover = 0;
    try {
      result = renderHook(() => ({ auth: useAuth(), store: useAuthStore() }), {
        wrapper,
      }).result;

      await advanceSeconds(2);
      // Stand in for fetchAccessToken exchanging the opaque token for a JWT.
      await act(async () => {
        result.current.store.set('token', jwt);
        result.current.store.set('expiresAt', decodeJwtExp(jwt));
        result.current.store.set('sessionSyncGraceUntil', null);
      });
      callsAtTakeover = authFetch.mock.calls.length;
      await advanceSeconds(40);
    } finally {
      jest.useRealTimers();
    }

    // The restore stands down instead of racing the live token.
    expect(authFetch).toHaveBeenCalledTimes(callsAtTakeover);
    expect(result.current.store.get('token')).toBe(jwt);
  });

  test('ignores a restored session after the persisted token loses ownership', async () => {
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };
    const restored = {
      session: { id: 'stale-session' },
      user: { email: 'stale@example.com' },
    };
    let resolveFetch!: (value: { data: typeof restored }) => void;
    const authFetch = mock(
      () =>
        new Promise<{ data: typeof restored }>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const authClient = {
      useSession: () => ({ data: null, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: null } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );
    const { result } = renderHook(() => useAuthStore(), { wrapper });

    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    act(() => {
      result.current.set('token', null);
      result.current.set('expiresAt', null);
      result.current.set('sessionSyncGraceUntil', null);
    });
    await act(async () => {
      resolveFetch({ data: restored });
      await Promise.resolve();
    });

    expect(result.current.get('token')).toBeNull();
    expect(window.sessionStorage.getItem('kitcn.auth.session-data')).toBeNull();
  });

  test('accepts a restored session when the seeded session was cloned', async () => {
    const persisted = {
      session: { id: 'persisted-session' },
      user: { email: 'persisted@example.com' },
    };
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );
    window.sessionStorage.setItem(
      'kitcn.auth.session-data',
      JSON.stringify(persisted)
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };
    const restored = {
      session: { id: 'persisted-session' },
      user: { email: 'fresh@example.com' },
    };
    let currentSession: unknown = null;
    let resolveFetch!: (value: { data: typeof restored }) => void;
    const authFetch = mock(
      () =>
        new Promise<{ data: typeof restored }>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const sessionAtom = {
      get: () => ({ refetch: async () => {} }),
      set: mock((value: { data: unknown }) => {
        currentSession = structuredClone(value.data);
      }),
    };
    const authClient = {
      $store: { atoms: { session: sessionAtom } },
      useSession: () => ({ data: currentSession, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: null } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );
    const { rerender } = renderHook(() => useAuthStore(), { wrapper });

    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    rerender();
    await act(async () => {
      resolveFetch({ data: restored });
      await Promise.resolve();
    });

    expect(window.sessionStorage.getItem('kitcn.auth.session-data')).toBe(
      JSON.stringify(restored)
    );
  });

  test('ignores a restored session after a different session takes over', async () => {
    const persisted = {
      session: { id: 'persisted-session' },
      user: { email: 'persisted@example.com' },
    };
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );
    window.sessionStorage.setItem(
      'kitcn.auth.session-data',
      JSON.stringify(persisted)
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };
    const stale = {
      session: { id: 'persisted-session' },
      user: { email: 'stale@example.com' },
    };
    let currentSession: unknown = null;
    let resolveFetch!: (value: { data: typeof stale }) => void;
    const authFetch = mock(
      () =>
        new Promise<{ data: typeof stale }>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const authClient = {
      useSession: () => ({ data: currentSession, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: null } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );
    const { rerender } = renderHook(() => useAuthStore(), { wrapper });

    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    currentSession = {
      session: { id: 'new-session' },
      user: { email: 'new@example.com' },
    };
    rerender();
    await act(async () => {
      resolveFetch({ data: stale });
      await Promise.resolve();
    });

    expect(window.sessionStorage.getItem('kitcn.auth.session-data')).toBe(
      JSON.stringify(persisted)
    );
  });

  test('expires persisted-token recovery when a request never settles', async () => {
    window.sessionStorage.setItem(
      'kitcn.auth.session-token',
      'persisted-session-token'
    );

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };
    const authFetch = mock(() => new Promise(() => {}));
    const authClient = {
      useSession: () => ({ data: null, isPending: false }),
      $fetch: authFetch,
      convex: { token: mock(async () => ({ data: { token: null } })) },
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    jest.useFakeTimers();
    let result: {
      current: { auth: ReturnType<typeof useAuth>; store: AuthStore };
    };
    try {
      result = renderHook(() => ({ auth: useAuth(), store: useAuthStore() }), {
        wrapper,
      }).result;
      await advanceSeconds(40);
    } finally {
      jest.useRealTimers();
    }

    expect(result.current.auth.isLoading).toBe(false);
    expect(result.current.store.get('token')).toBeNull();
    expect(result.current.store.get('sessionSyncGraceUntil')).toBeNull();
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  test('keeps a cached JWT when a later token refresh returns null', async () => {
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const firstJwt = makeJwt(7200);
    const convexToken = mock(async () => ({ data: { token: firstJwt } }));

    const authClient = {
      useSession: () => ({
        data: { session: { id: 'session-1' } },
        isPending: false,
      }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(
      () => ({
        fetchAccessToken: useFetchAccessToken(),
        store: useAuthStore(),
      }),
      { wrapper }
    );

    await act(async () => {
      const fetched = await result.current.fetchAccessToken!({
        forceRefreshToken: true,
      });
      expect(fetched).toBe(firstJwt);
    });

    convexToken.mockImplementationOnce(async () => ({ data: {} }));

    await act(async () => {
      const fetched = await result.current.fetchAccessToken!({
        forceRefreshToken: true,
      });
      expect(fetched).toBe(firstJwt);
    });

    expect(result.current.store.get('token')).toBe(firstJwt);
  });

  test('does not fall back to an expired cached JWT when refresh returns null', async () => {
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const expiredJwt = makeJwt(-60);
    const convexToken = mock(async () => ({ data: {} }));

    const authClient = {
      useSession: () => ({
        data: { session: { id: 'session-1' } },
        isPending: false,
      }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(
      () => ({
        fetchAccessToken: useFetchAccessToken(),
        store: useAuthStore(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.store.set('token', expiredJwt);
      result.current.store.set('expiresAt', decodeJwtExp(expiredJwt));
    });

    let fetched: string | null = 'placeholder';
    await act(async () => {
      fetched = await result.current.fetchAccessToken!({
        forceRefreshToken: true,
      });
    });

    expect(fetched as string | null).toBeNull();
    expect(result.current.store.get('token')).toBeNull();
    expect(result.current.store.get('expiresAt')).toBeNull();
  });

  test('deduplicates concurrent token fetches', async () => {
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const jwt = makeJwt(7200);
    const convexToken = mock(async (_opts?: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { data: { token: jwt } };
    });

    const authClient = {
      useSession: () => ({
        data: { session: { id: 'session-1' } },
        isPending: false,
      }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useFetchAccessToken(), { wrapper });
    expect(typeof result.current).toBe('function');

    await act(async () => {
      const tokens = (await Promise.all([
        result.current!({ forceRefreshToken: false }),
        result.current!({ forceRefreshToken: false }),
      ])) as Array<string | null>;
      expect(tokens).toEqual([jwt, jwt]);
    });
    expect(convexToken).toHaveBeenCalledTimes(1);
  });

  test('treats empty session payload as unauthenticated', async () => {
    const initialToken = makeJwt(3600);
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const convexToken = mock(async () => ({ data: { token: makeJwt(7200) } }));

    const authClient = {
      useSession: () => ({ data: {}, isPending: false }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider
        authClient={authClient as any}
        client={client as any}
        initialToken={initialToken}
      >
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useFetchAccessToken(), { wrapper });
    expect(typeof result.current).toBe('function');

    let fetched: string | null = null;
    await act(async () => {
      fetched = await result.current!({ forceRefreshToken: false });
    });

    expect(fetched).toBeNull();
    expect(convexToken).toHaveBeenCalledTimes(0);
  });

  test('treats user-only payload as unauthenticated when session object is missing', async () => {
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const convexToken = mock(async () => ({ data: { token: makeJwt(7200) } }));

    const authClient = {
      useSession: () => ({
        data: { user: { id: 'user-1' } },
        isPending: false,
      }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useFetchAccessToken(), { wrapper });
    expect(typeof result.current).toBe('function');

    let fetched: string | null = null;
    await act(async () => {
      fetched = await result.current!({ forceRefreshToken: false });
    });

    expect(fetched).toBeNull();
    expect(convexToken).toHaveBeenCalledTimes(0);
  });

  describe('onTokenIdentityChange', () => {
    /** Runs a token fetch inside act, so the store updates it causes flush. */
    const fetchInAct = async (
      fetchToken: (args: {
        forceRefreshToken: boolean;
      }) => Promise<string | null>,
      forceRefreshToken: boolean
    ) => {
      let token: string | null = null;
      await act(async () => {
        token = await fetchToken({ forceRefreshToken });
      });
      return token;
    };
    const identityJwt = (sub: string, sessionId: string, expSeconds = 3600) => {
      const payload = btoa(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + expSeconds,
          sessionId,
          sub,
        })
      );
      return `x.${payload}.z`;
    };

    const guardHarness = ({
      guard,
      refreshed,
    }: {
      guard: boolean;
      refreshed: string;
    }) => {
      let fetchToken:
        | ((args: { forceRefreshToken: boolean }) => Promise<string | null>)
        | null = null;
      const close = mock(async () => {});
      const client = {
        setAuth: (fetcher: typeof fetchToken) => {
          fetchToken = fetcher;
        },
        clearAuth: () => {},
        close,
      };
      const authClient = {
        useSession: () => ({ data: null, isPending: true }),
        convex: { token: async () => ({ data: { token: refreshed } }) },
        getSession: async () => null,
        updateSession: () => {},
        crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
      };
      const onTokenIdentityChange = mock(() => {});
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ConvexAuthProvider
          authClient={authClient as any}
          client={client as any}
          initialToken={identityJwt('user_a', 'session_a')}
          onTokenIdentityChange={guard ? onTokenIdentityChange : undefined}
        >
          {children}
        </ConvexAuthProvider>
      );
      renderHook(() => useAuth(), { wrapper });
      return {
        close,
        onTokenIdentityChange,
        fetch: (forceRefreshToken: boolean) => {
          if (!fetchToken) throw new Error('setAuth was not called');
          return fetchInAct(fetchToken, forceRefreshToken);
        },
      };
    };

    const flush = () =>
      act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

    test("the reviewer's sequence: SSR token A near expiry, the first fetch returns B", async () => {
      let fetchToken:
        | ((args: { forceRefreshToken: boolean }) => Promise<string | null>)
        | null = null;
      const close = mock(async () => {});
      const client = {
        setAuth: (fetcher: typeof fetchToken) => {
          fetchToken = fetcher;
        },
        clearAuth: () => {},
        close,
      };
      const tokenForB = identityJwt('user_b', 'session_b');
      const authClient = {
        // Better Auth already has a session: kitcn fetches instead of reusing A.
        useSession: () => ({
          data: { session: { id: 'session_a' }, user: { id: 'user_a' } },
          isPending: false,
        }),
        convex: { token: async () => ({ data: { token: tokenForB } }) },
        getSession: async () => null,
        updateSession: () => {},
        crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
      };
      const onTokenIdentityChange = mock(() => {});
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ConvexAuthProvider
          authClient={authClient as any}
          client={client as any}
          initialToken={identityJwt('user_a', 'session_a', 30)}
          onTokenIdentityChange={onTokenIdentityChange}
        >
          {children}
        </ConvexAuthProvider>
      );
      const { result } = renderHook(() => useAuthStore(), { wrapper });
      await flush();
      if (!fetchToken) throw new Error('setAuth was not called');

      expect(await fetchInAct(fetchToken, false)).toBeNull();
      expect(onTokenIdentityChange).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
      // B never reached the cache, and nothing is handed out any more.
      expect(result.current.get('token')).not.toBe(tokenForB);
      expect(await fetchInAct(fetchToken, true)).toBeNull();
    });

    test('no SSR token: the first token a sign-in obtains sets the identity', async () => {
      let fetchToken:
        | ((args: { forceRefreshToken: boolean }) => Promise<string | null>)
        | null = null;
      const close = mock(async () => {});
      const client = {
        setAuth: (fetcher: typeof fetchToken) => {
          fetchToken = fetcher;
        },
        clearAuth: () => {},
        close,
      };
      const tokenForC = identityJwt('user_c', 'session_c');
      const authClient = {
        useSession: () => ({
          data: { session: { id: 'session_c' }, user: { id: 'user_c' } },
          isPending: false,
        }),
        convex: { token: async () => ({ data: { token: tokenForC } }) },
        getSession: async () => null,
        updateSession: () => {},
        crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
      };
      const onTokenIdentityChange = mock(() => {});
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ConvexAuthProvider
          authClient={authClient as any}
          client={client as any}
          onTokenIdentityChange={onTokenIdentityChange}
        >
          {children}
        </ConvexAuthProvider>
      );
      renderHook(() => useAuth(), { wrapper });
      await flush();
      if (!fetchToken) throw new Error('setAuth was not called');

      expect(await fetchInAct(fetchToken, false)).toBe(tokenForC);
      expect(onTokenIdentityChange).toHaveBeenCalledTimes(0);
      expect(close).toHaveBeenCalledTimes(0);
    });

    test('never hands Convex a token for another user or session', async () => {
      const harness = guardHarness({
        guard: true,
        refreshed: identityJwt('user_b', 'session_b'),
      });
      await flush();

      expect(await harness.fetch(false)).not.toBeNull();
      expect(await harness.fetch(true)).toBeNull();
      expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
      expect(harness.close).toHaveBeenCalledTimes(1);
    });

    test('passes a refreshed token for the same session through', async () => {
      const refreshed = identityJwt('user_a', 'session_a', 7200);
      const harness = guardHarness({ guard: true, refreshed });
      await flush();

      await harness.fetch(false);
      expect(await harness.fetch(true)).toBe(refreshed);
      expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(0);
      expect(harness.close).toHaveBeenCalledTimes(0);
    });

    describe('tokenIdentityBaseline', () => {
      /** A remount without a token, whose first fetch returns `obtained`. */
      const remount = ({
        baseline,
        obtained,
      }: {
        baseline: string | null | undefined;
        obtained: string;
      }) => {
        let fetchToken:
          | ((args: { forceRefreshToken: boolean }) => Promise<string | null>)
          | null = null;
        const close = mock(async () => {});
        const client = {
          setAuth: (fetcher: typeof fetchToken) => {
            fetchToken = fetcher;
          },
          clearAuth: () => {},
          close,
        };
        const authClient = {
          useSession: () => ({
            data: { session: { id: 'session' }, user: { id: 'user' } },
            isPending: false,
          }),
          convex: { token: async () => ({ data: { token: obtained } }) },
          getSession: async () => null,
          updateSession: () => {},
          crossDomain: {
            oneTimeToken: { verify: async () => ({ data: {} }) },
          },
        };
        const onTokenIdentityChange = mock(() => {});
        const wrapper = ({ children }: { children: ReactNode }) => (
          <ConvexAuthProvider
            authClient={authClient as any}
            client={client as any}
            onTokenIdentityChange={onTokenIdentityChange}
            tokenIdentityBaseline={baseline}
          >
            {children}
          </ConvexAuthProvider>
        );
        renderHook(() => useAuth(), { wrapper });
        return {
          close,
          onTokenIdentityChange,
          fetch: (forceRefreshToken: boolean) => {
            if (!fetchToken) throw new Error('setAuth was not called');
            return fetchInAct(fetchToken, forceRefreshToken);
          },
        };
      };

      test('a remount without a token refuses a first token of another identity', async () => {
        const harness = remount({
          baseline: 'user_a|session_a',
          obtained: identityJwt('user_b', 'session_b'),
        });
        await flush();

        expect(await harness.fetch(false)).toBeNull();
        expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
        expect(harness.close).toHaveBeenCalledTimes(1);
        expect(await harness.fetch(true)).toBeNull();
      });

      test('a remount without a token admits a token of the same identity', async () => {
        const sameSession = identityJwt('user_a', 'session_a');
        const harness = remount({
          baseline: 'user_a|session_a',
          obtained: sameSession,
        });
        await flush();

        expect(await harness.fetch(false)).toBe(sameSession);
        expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(0);
        expect(harness.close).toHaveBeenCalledTimes(0);
      });

      test('without a baseline the first token obtained sets the identity, as before', async () => {
        const first = identityJwt('user_b', 'session_b');
        for (const baseline of [undefined, null]) {
          const harness = remount({ baseline, obtained: first });
          await flush();

          expect(await harness.fetch(false)).toBe(first);
          expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(0);
          expect(harness.close).toHaveBeenCalledTimes(0);
        }
      });
    });

    describe('tokenIdentityBaseline getter and onTokenIdentityAdmitted', () => {
      /**
       * A mount with a Better Auth session and no token of its own; each
       * fresh fetch returns the next of `obtained`. `document.identity` is
       * what the baseline getter answers, read whenever the guard asks.
       */
      const documentHarness = ({
        getter = true,
        guard = true,
        identity,
        obtained,
      }: {
        getter?: boolean;
        guard?: boolean;
        identity: string | null;
        obtained: string[];
      }) => {
        let fetchToken:
          | ((args: { forceRefreshToken: boolean }) => Promise<string | null>)
          | null = null;
        const setAuth = mock((fetcher: typeof fetchToken) => {
          fetchToken = fetcher;
        });
        const close = mock(async () => {});
        const client = { setAuth, clearAuth: () => {}, close };
        const queue = [...obtained];
        const convexToken = mock(async () => ({
          data: { token: queue.shift() ?? null },
        }));
        const authClient = {
          useSession: () => ({
            data: { session: { id: 'session' }, user: { id: 'user' } },
            isPending: false,
          }),
          convex: { token: convexToken },
          getSession: async () => null,
          updateSession: () => {},
          crossDomain: {
            oneTimeToken: { verify: async () => ({ data: {} }) },
          },
        };
        const document = { identity };
        const readBaseline = mock(() => document.identity);
        const onTokenIdentityChange = mock(() => {});
        const onTokenIdentityAdmitted = mock((_token: string) => {});
        const Provider = ({
          children,
          onAdmitted,
        }: {
          children: ReactNode;
          onAdmitted: (token: string) => void;
        }) => (
          <ConvexAuthProvider
            authClient={authClient as any}
            client={client as any}
            onTokenIdentityAdmitted={onAdmitted}
            onTokenIdentityChange={guard ? onTokenIdentityChange : undefined}
            tokenIdentityBaseline={getter ? readBaseline : identity}
          >
            {children}
          </ConvexAuthProvider>
        );
        let onAdmitted: (token: string) => void = onTokenIdentityAdmitted;
        const view = renderHook(() => useAuth(), {
          wrapper: ({ children }: { children: ReactNode }) => (
            <Provider onAdmitted={onAdmitted}>{children}</Provider>
          ),
        });
        return {
          close,
          convexToken,
          document,
          onTokenIdentityAdmitted,
          onTokenIdentityChange,
          readBaseline,
          setAuth,
          fetch: (forceRefreshToken: boolean) => {
            if (!fetchToken) throw new Error('setAuth was not called');
            return fetchInAct(fetchToken, forceRefreshToken);
          },
          replaceOnAdmitted: (next: (token: string) => void) => {
            onAdmitted = next;
            view.rerender();
          },
        };
      };

      test('the getter is read at admission, not at mount: a remount refuses a token of another identity', async () => {
        // The document speaks for no one when this provider mounts, then
        // another mount establishes A before this one's first token arrives.
        const harness = documentHarness({
          identity: null,
          obtained: [identityJwt('user_b', 'session_b')],
        });
        await flush();
        harness.document.identity = 'user_a|session_a';

        expect(await harness.fetch(false)).toBeNull();
        expect(harness.readBaseline).toHaveBeenCalled();
        expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
        expect(harness.close).toHaveBeenCalledTimes(1);
        expect(harness.onTokenIdentityAdmitted).toHaveBeenCalledTimes(0);
        expect(await harness.fetch(true)).toBeNull();
      });

      test('a cached token is refused once the document moved to another identity', async () => {
        const tokenForA = identityJwt('user_a', 'session_a');
        const harness = documentHarness({
          identity: 'user_a|session_a',
          obtained: [tokenForA],
        });
        await flush();

        expect(await harness.fetch(false)).toBe(tokenForA);
        // Kept mounted but hidden while the document moved on to B.
        harness.document.identity = 'user_b|session_b';

        expect(await harness.fetch(false)).toBeNull();
        // The refused token was the cached one: no second fetch happened.
        expect(harness.convexToken).toHaveBeenCalledTimes(1);
        expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
        expect(harness.close).toHaveBeenCalledTimes(1);
        expect(harness.onTokenIdentityAdmitted).toHaveBeenCalledTimes(1);
      });

      test('a getter answering null does not constrain; the guard keeps the identity it admitted', async () => {
        const tokenForA = identityJwt('user_a', 'session_a');
        const harness = documentHarness({
          identity: null,
          obtained: [tokenForA, identityJwt('user_b', 'session_b')],
        });
        await flush();

        expect(await harness.fetch(false)).toBe(tokenForA);
        expect(await harness.fetch(true)).toBeNull();
        expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
        expect(harness.onTokenIdentityAdmitted.mock.calls).toEqual([
          [tokenForA],
        ]);
      });

      test('onTokenIdentityAdmitted hears every admitted token once, cached ones included', async () => {
        const first = identityJwt('user_a', 'session_a');
        const refreshed = identityJwt('user_a', 'session_a', 7200);
        const harness = documentHarness({
          identity: 'user_a|session_a',
          obtained: [first, refreshed],
        });
        await flush();

        expect(await harness.fetch(false)).toBe(first);
        expect(await harness.fetch(false)).toBe(first);
        expect(await harness.fetch(true)).toBe(refreshed);
        expect(harness.convexToken).toHaveBeenCalledTimes(2);
        expect(harness.onTokenIdentityAdmitted.mock.calls).toEqual([
          [first],
          [first],
          [refreshed],
        ]);
        expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(0);
      });

      test('onTokenIdentityAdmitted is never called for a refused token, nor after the guard tripped', async () => {
        const harness = documentHarness({
          getter: false,
          identity: 'user_a|session_a',
          obtained: [
            identityJwt('user_b', 'session_b'),
            identityJwt('user_a', 'session_a'),
          ],
        });
        await flush();

        expect(await harness.fetch(false)).toBeNull();
        expect(await harness.fetch(true)).toBeNull();
        expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
        expect(harness.onTokenIdentityAdmitted).toHaveBeenCalledTimes(0);
      });

      test('a new onTokenIdentityAdmitted is used without handing Convex a new fetcher', async () => {
        const token = identityJwt('user_a', 'session_a');
        const harness = documentHarness({
          identity: 'user_a|session_a',
          obtained: [token],
        });
        await flush();
        const setAuthCalls = harness.setAuth.mock.calls.length;
        const next = mock((_token: string) => {});
        harness.replaceOnAdmitted(next);
        await flush();

        expect(await harness.fetch(false)).toBe(token);
        expect(harness.setAuth).toHaveBeenCalledTimes(setAuthCalls);
        expect(next.mock.calls).toEqual([[token]]);
        expect(harness.onTokenIdentityAdmitted).toHaveBeenCalledTimes(0);
      });

      test('onTokenIdentityAdmitted needs onTokenIdentityChange', async () => {
        const token = identityJwt('user_b', 'session_b');
        const harness = documentHarness({
          guard: false,
          identity: 'user_a|session_a',
          obtained: [token],
        });
        await flush();

        expect(await harness.fetch(false)).toBe(token);
        expect(harness.onTokenIdentityAdmitted).toHaveBeenCalledTimes(0);
        expect(harness.close).toHaveBeenCalledTimes(0);
      });
    });

    test('changes nothing without the option', async () => {
      const refreshed = identityJwt('user_b', 'session_b');
      const harness = guardHarness({ guard: false, refreshed });
      await flush();

      await harness.fetch(false);
      expect(await harness.fetch(true)).toBe(refreshed);
      expect(harness.close).toHaveBeenCalledTimes(0);
    });
  });

  describe('optimisticAuth', () => {
    const optimisticHarness = (
      initialToken: string,
      optimisticAuth: boolean
    ) => {
      let reportAuth: ((isAuthenticated: boolean) => void) | null = null;
      const client = {
        // Holds the confirmation until the test decides what the server says.
        setAuth: (_fetchToken: unknown, onChange: (value: boolean) => void) => {
          reportAuth = onChange;
        },
        clearAuth: () => {},
      };
      const authClient = {
        useSession: () => ({ data: null, isPending: true }),
        convex: { token: async () => ({ data: {} }) },
        getSession: async () => null,
        updateSession: () => {},
        crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
      };
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ConvexAuthProvider
          authClient={authClient as any}
          client={client as any}
          initialToken={initialToken}
          optimisticAuth={optimisticAuth}
        >
          {children}
        </ConvexAuthProvider>
      );
      const hook = renderHook(
        () => ({ auth: useAuth(), store: useAuthStore() }),
        { wrapper }
      );
      return { ...hook, report: (value: boolean) => reportAuth?.(value) };
    };

    const flush = () =>
      act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

    test('opens the gate on a held, unexpired JWT before Convex confirms it', async () => {
      const { result } = optimisticHarness(makeJwt(3600), true);
      await flush();

      expect(result.current.auth.isLoading).toBe(false);
      expect(result.current.auth.isAuthenticated).toBe(true);
    });

    test('waits for the confirmation without the option', async () => {
      const { result } = optimisticHarness(makeJwt(3600), false);
      await flush();

      expect(result.current.auth.isLoading).toBe(true);
      expect(result.current.auth.isAuthenticated).toBe(false);
    });

    test('keeps the gate closed for an expired JWT', async () => {
      const { result } = optimisticHarness(makeJwt(-10), true);
      await flush();

      expect(result.current.auth.isLoading).toBe(true);
      expect(result.current.auth.isAuthenticated).toBe(false);
    });

    // That it never reopens is proven through real re-confirmations in
    // 'a token Convex refused never reopens the optimistic gate'.
    test('a refused token closes the gate', async () => {
      const { result, report } = optimisticHarness(makeJwt(3600), true);
      await flush();
      expect(result.current.auth.isAuthenticated).toBe(true);

      await act(async () => report(false));

      expect(result.current.auth.isAuthenticated).toBe(false);
      expect(result.current.auth.isLoading).toBe(true);
    });

    test('the confirmed state takes over once Convex confirms', async () => {
      const { result, report } = optimisticHarness(makeJwt(3600), true);
      await flush();

      await act(async () => report(true));

      expect(result.current.auth.isLoading).toBe(false);
      expect(result.current.auth.isAuthenticated).toBe(true);
    });
  });

  describe('identity guard admission', () => {
    const identityJwt = (sub: string, sessionId: string, expSeconds = 3600) =>
      `x.${btoa(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + expSeconds,
          sessionId,
          sub,
        })
      )}.z`;
    const claim = (token: string) => {
      const payload = JSON.parse(atob(token.split('.')[1]!));
      return `${payload.sub}|${payload.sessionId}`;
    };

    /**
     * A provider over a Convex client stub that records every binding (the
     * fetcher and confirmation callback Convex receives), so a test drives
     * the real confirmation transitions. `tokens` are what the token endpoint
     * answers, in order.
     */
    const convexHarness = ({
      baseline,
      guard = true,
      initialToken,
      onTokenIdentityAdmitted,
      onTokenIdentityChange = mock(() => {}),
      optimisticAuth = false,
      session = 'active',
      tokens = [],
    }: {
      baseline?: string | null | (() => string | null);
      guard?: boolean;
      initialToken?: string;
      onTokenIdentityAdmitted?: (token: string) => void;
      onTokenIdentityChange?: () => void;
      optimisticAuth?: boolean;
      session?: 'active' | 'none' | 'pending';
      tokens?: Array<string | null>;
    }) => {
      const bindings: Array<{
        fetchToken: (args: {
          forceRefreshToken: boolean;
        }) => Promise<string | null>;
        onChange: (isAuthenticated: boolean) => void;
      }> = [];
      const close = mock(async () => {});
      const client = {
        setAuth: (
          fetchToken: (typeof bindings)[number]['fetchToken'],
          onChange: (typeof bindings)[number]['onChange']
        ) => {
          bindings.push({ fetchToken, onChange });
        },
        clearAuth: () => {},
        close,
      };
      const queue = [...tokens];
      const convexToken = mock(async () => ({
        data: { token: queue.shift() ?? null },
      }));
      const getSession = mock(async () => null);
      const $fetch = mock(async () => ({ data: null, error: null }));
      const sessionResult =
        session === 'active'
          ? {
              data: { session: { id: 'session' }, user: { id: 'user' } },
              isPending: false,
            }
          : { data: null, isPending: session === 'pending' };
      const authClient = {
        useSession: () => sessionResult,
        convex: { token: convexToken },
        getSession,
        $fetch,
        updateSession: () => {},
        crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
      };
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ConvexAuthProvider
          authClient={authClient as any}
          client={client as any}
          initialToken={initialToken}
          onTokenIdentityAdmitted={onTokenIdentityAdmitted}
          onTokenIdentityChange={guard ? onTokenIdentityChange : undefined}
          optimisticAuth={optimisticAuth}
          tokenIdentityBaseline={baseline}
        >
          {children}
        </ConvexAuthProvider>
      );
      let recovery: ReturnType<typeof useConvexAuthRecovery> | undefined;
      const view = renderHook(
        () => {
          recovery = useConvexAuthRecovery();
          return { auth: useAuth(), store: useAuthStore() };
        },
        { wrapper }
      );
      const latest = () => {
        const binding = bindings.at(-1);
        if (!binding) throw new Error('setAuth was not called');
        return binding;
      };
      return {
        $fetch,
        bindings,
        close,
        convexToken,
        getSession,
        onTokenIdentityChange,
        result: view.result,
        fetch: async (forceRefreshToken: boolean) => {
          let token: string | null = null;
          await act(async () => {
            token = await latest().fetchToken({ forceRefreshToken });
          });
          return token;
        },
        recover: async () => {
          const before = bindings.length;
          await act(async () => {
            void recovery!.recover({ timeoutMs: 1000 }).catch(() => {});
          });
          await waitFor(() => {
            expect(bindings.length).toBeGreaterThan(before);
          });
        },
        report: (isAuthenticated: boolean) =>
          act(async () => {
            latest().onChange(isAuthenticated);
          }),
      };
    };

    const flush = () =>
      act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

    test('a held SSR token of another identity never opens the optimistic gate and trips the guard', async () => {
      const harness = convexHarness({
        baseline: 'user_a|session_a',
        initialToken: identityJwt('user_b', 'session_b'),
        optimisticAuth: true,
        session: 'pending',
      });
      await flush();

      expect(harness.result.current.store.get('token')).toBeNull();
      expect(harness.result.current.auth.isAuthenticated).toBe(false);
      expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
      expect(harness.close).toHaveBeenCalledTimes(1);
      // With the token withheld and the session pending, Convex is not even
      // bound yet: it is never handed the refused token.
      expect(harness.bindings).toHaveLength(0);
    });

    test('a held SSR token of the baseline identity still opens the optimistic gate', async () => {
      const token = identityJwt('user_a', 'session_a');
      const harness = convexHarness({
        baseline: 'user_a|session_a',
        initialToken: token,
        optimisticAuth: true,
        session: 'pending',
      });
      await flush();

      expect(harness.result.current.store.get('token')).toBe(token);
      expect(harness.result.current.auth.isAuthenticated).toBe(true);
      expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(0);
    });

    test('a token seeded into the store opens the optimistic gate only if the guard would admit it', async () => {
      const harness = convexHarness({
        baseline: 'user_a|session_a',
        optimisticAuth: true,
        session: 'pending',
      });
      await flush();

      await act(async () => {
        harness.result.current.store.set(
          'token',
          identityJwt('user_b', 'session_b')
        );
      });
      expect(harness.result.current.auth.isAuthenticated).toBe(false);

      await act(async () => {
        harness.result.current.store.set(
          'token',
          identityJwt('user_a', 'session_a')
        );
      });
      expect(harness.result.current.auth.isAuthenticated).toBe(true);
    });

    test('a persisted session token is not restored while an identity is established', async () => {
      writeAuthSessionFallbackToken('opaque-session-token');
      const harness = convexHarness({
        baseline: 'user_a|session_a',
        session: 'none',
      });
      await flush();

      expect(harness.getSession).toHaveBeenCalledTimes(0);
      expect(harness.$fetch).toHaveBeenCalledTimes(0);
      expect(harness.result.current.store.get('token')).toBeNull();
    });

    test('concurrent first tokens: the losing identity is never cached', async () => {
      const document: { identity: string | null } = { identity: null };
      const claimDocument = (token: string) => {
        document.identity ??= claim(token);
      };
      const tokenForA = identityJwt('user_a', 'session_a');
      const tokenForB = identityJwt('user_b', 'session_b');
      const first = convexHarness({
        baseline: () => document.identity,
        onTokenIdentityAdmitted: claimDocument,
        tokens: [tokenForA],
      });
      const second = convexHarness({
        baseline: () => document.identity,
        onTokenIdentityAdmitted: claimDocument,
        tokens: [tokenForB],
      });
      await flush();
      const published: Array<string | null> = [];
      const unsubscribe = second.result.current.store.subscribe(
        'token',
        (value: string | null) => {
          published.push(value);
        }
      );

      let results: Array<string | null> = [];
      await act(async () => {
        results = await Promise.all([
          first.bindings.at(-1)!.fetchToken({ forceRefreshToken: false }),
          second.bindings.at(-1)!.fetchToken({ forceRefreshToken: false }),
        ]);
      });
      unsubscribe();

      expect(results).toEqual([tokenForA, null]);
      expect(published).not.toContain(tokenForB);
      expect(second.onTokenIdentityChange).toHaveBeenCalledTimes(1);
      expect(first.onTokenIdentityChange).toHaveBeenCalledTimes(0);
    });

    test('a trip publishes a terminal unauthenticated state that Convex cannot reopen', async () => {
      const harness = convexHarness({
        initialToken: identityJwt('user_a', 'session_a'),
        tokens: [identityJwt('user_b', 'session_b')],
      });
      await flush();
      expect(await harness.fetch(false)).not.toBeNull();
      await harness.report(true);
      expect(harness.result.current.store.get('isAuthenticated')).toBe(true);

      expect(await harness.fetch(true)).toBeNull();

      expect(harness.result.current.store.get('token')).toBeNull();
      expect(harness.result.current.store.get('isAuthenticated')).toBe(false);
      expect(harness.result.current.store.get('isLoading')).toBe(false);
      await harness.report(true);
      expect(harness.result.current.store.get('isAuthenticated')).toBe(false);
    });

    test('a throwing onTokenIdentityChange still closes the client', async () => {
      const onTokenIdentityChange = mock(() => {
        throw new Error('callback failed');
      });
      const consoleError = spyOn(console, 'error').mockImplementation(() => {});
      try {
        const harness = convexHarness({
          initialToken: identityJwt('user_a', 'session_a'),
          onTokenIdentityChange,
          tokens: [identityJwt('user_b', 'session_b')],
        });
        await flush();
        await harness.fetch(false);

        expect(await harness.fetch(true)).toBeNull();
        expect(onTokenIdentityChange).toHaveBeenCalledTimes(1);
        expect(harness.close).toHaveBeenCalledTimes(1);
      } finally {
        consoleError.mockRestore();
      }
    });

    test('with an identity established, a JWT without one is refused', async () => {
      const onTokenIdentityAdmitted = mock((_token: string) => {});
      const harness = convexHarness({
        baseline: 'user_a|session_a',
        onTokenIdentityAdmitted,
        tokens: [makeJwt(3600)],
      });
      await flush();

      expect(await harness.fetch(false)).toBeNull();
      expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
      expect(onTokenIdentityAdmitted).toHaveBeenCalledTimes(0);
    });

    test('an admitted identity refuses a later JWT without one', async () => {
      const tokenForA = identityJwt('user_a', 'session_a');
      const harness = convexHarness({ tokens: [tokenForA, makeJwt(7200)] });
      await flush();

      expect(await harness.fetch(false)).toBe(tokenForA);
      expect(await harness.fetch(true)).toBeNull();
      expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(1);
    });

    test('before any identity, a JWT without one is handed out and announced without setting it', async () => {
      const identityless = makeJwt(3600);
      const tokenForB = identityJwt('user_b', 'session_b', 7200);
      const onTokenIdentityAdmitted = mock((_token: string) => {});
      const harness = convexHarness({
        onTokenIdentityAdmitted,
        tokens: [identityless, tokenForB],
      });
      await flush();

      expect(await harness.fetch(false)).toBe(identityless);
      expect(await harness.fetch(true)).toBe(tokenForB);
      expect(onTokenIdentityAdmitted.mock.calls).toEqual([
        [identityless],
        [tokenForB],
      ]);
      expect(harness.onTokenIdentityChange).toHaveBeenCalledTimes(0);
    });

    test('a token Convex refused never reopens the optimistic gate, even after another refusal', async () => {
      const tokenA = makeJwt(3600);
      const tokenB = makeJwt(3500);
      const harness = convexHarness({
        guard: false,
        initialToken: tokenA,
        optimisticAuth: true,
        tokens: [tokenB, tokenA],
      });
      await flush();
      expect(await harness.fetch(false)).toBe(tokenA);
      await harness.report(false);
      expect(harness.result.current.auth.isAuthenticated).toBe(false);

      // Convex refuses B too, then the token endpoint answers A again.
      await harness.recover();
      expect(await harness.fetch(true)).toBe(tokenB);
      await harness.report(false);
      await harness.recover();
      expect(await harness.fetch(true)).toBe(tokenA);
      await flush();

      expect(harness.result.current.store.get('token')).toBe(tokenA);
      expect(harness.result.current.auth.isAuthenticated).toBe(false);
    });
  });

  test('useAuth reports unauthenticated when session is confirmed missing, even with SSR token', async () => {
    const initialToken = makeJwt(3600);
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const authClient = {
      useSession: () => ({ data: null, isPending: false }),
      convex: { token: async () => ({ data: {} }) },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider
        authClient={authClient as any}
        client={client as any}
        initialToken={initialToken}
      >
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.hasSession).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  test('exchanges a freshly seeded session token for a Convex JWT while session sync catches up', async () => {
    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const convexJwt = makeJwt(7200);
    const convexToken = mock(async () => ({ data: { token: convexJwt } }));

    const authClient = {
      useSession: () => ({ data: null, isPending: false }),
      convex: { token: convexToken },
      getSession: async () => null,
      updateSession: () => {},
      crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    const { result } = renderHook(
      () => ({
        auth: useAuth(),
        fetchAccessToken: useFetchAccessToken(),
        store: useAuthStore(),
      }),
      { wrapper }
    );

    await act(async () => {
      result.current.store.set('token', 'session-token');
      result.current.store.set('expiresAt', null);
      result.current.store.set('sessionSyncGraceUntil', Date.now() + 5_000);
    });

    let fetched: string | null = null;
    await act(async () => {
      fetched = await result.current.fetchAccessToken!({
        forceRefreshToken: false,
      });
    });

    expect(fetched).toBe(convexJwt);
    expect(result.current.store.get('token')).toBe(convexJwt);
    expect(result.current.auth.hasSession).toBe(true);
    expect(convexToken).toHaveBeenCalledTimes(1);
    expect(convexToken).toHaveBeenCalledWith({
      fetchOptions: {
        credentials: 'omit',
        headers: {
          Authorization: 'Bearer session-token',
        },
        throw: false,
      },
    });
  });

  test('verifies OTT and refreshes session, then removes ott from the URL', async () => {
    const ott = 'OTT123';

    window.history.replaceState({}, '', `/?ott=${ott}`);
    let currentOtt = new URL(window.location.href).searchParams.get('ott');
    if (currentOtt !== ott) {
      try {
        window.location.href = `http://localhost/?ott=${ott}`;
      } catch {
        // Ignore - we'll assert based on actual href below.
      }
      currentOtt = new URL(window.location.href).searchParams.get('ott');
    }
    expect(currentOtt).toBe(ott);

    const verify = mock(async () => {
      expect(new URL(window.location.href).searchParams.get('ott')).toBeNull();
      return {
        data: { session: { token: 'SESSION_TOKEN' } },
      };
    });
    const getSession = mock(async (_opts: any) => null);
    const updateSession = mock(() => {});

    const client = {
      setAuth: () => {},
      clearAuth: () => {},
    };

    const authClient = {
      useSession: () => ({ data: null, isPending: false }),
      convex: { token: async () => ({ data: {} }) },
      getSession,
      updateSession,
      crossDomain: { oneTimeToken: { verify } },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexAuthProvider authClient={authClient as any} client={client as any}>
        {children}
      </ConvexAuthProvider>
    );

    renderHook(() => null, { wrapper });

    // Flush the async IIFE started in useEffect().
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(verify.mock.calls.length).toBeGreaterThan(0);
    expect(verify).toHaveBeenCalledWith({ token: ott });
    expect(getSession.mock.calls.length).toBeGreaterThan(0);
    expect(getSession).toHaveBeenCalledWith({
      fetchOptions: {
        credentials: 'omit',
        headers: { Authorization: 'Bearer SESSION_TOKEN' },
      },
    });
    expect(updateSession.mock.calls.length).toBeGreaterThan(0);

    const url = new URL(window.location.href);
    expect(url.searchParams.get('ott')).toBeNull();
  });
});
