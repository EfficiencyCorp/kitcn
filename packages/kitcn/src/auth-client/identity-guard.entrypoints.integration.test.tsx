import { act, renderHook } from '@testing-library/react';
import { ConvexAuthProvider } from 'kitcn/auth/client';
import { syncConvexAuthForStartLoader } from 'kitcn/auth/start';
import { useAuth } from 'kitcn/react';
import type { ReactNode } from 'react';
import { resetDocumentTripForTests } from '../react/identity-guard-trip';

// Built entries: `kitcn/auth/start` is bundled apart from `kitcn/auth/client`
// and `kitcn/react`, so the identity guard's page state must be shared
// across bundles, not per module copy.
const identityJwt = (sub: string, sessionId: string, expSeconds = 3600) =>
  `x.${btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expSeconds,
      sessionId,
      sub,
    })
  )}.z`;

type FetchToken = (args: {
  forceRefreshToken: boolean;
}) => Promise<string | null>;

const mountProvider = ({
  baseline,
  client,
  initialToken,
  optimisticAuth = false,
  session = 'active',
  tokens = [],
}: {
  baseline?: string;
  client: { setAuth: (fetchToken: FetchToken) => void };
  initialToken?: string;
  optimisticAuth?: boolean;
  session?: 'active' | 'pending';
  tokens?: string[];
}) => {
  const queue = [...tokens];
  const onTokenIdentityChange = mock(() => {});
  const authClient = {
    convex: { token: async () => ({ data: { token: queue.shift() ?? null } }) },
    crossDomain: { oneTimeToken: { verify: async () => ({ data: {} }) } },
    getSession: async () => null,
    updateSession: () => {},
    useSession: () =>
      session === 'active'
        ? {
            data: { session: { id: 's' }, user: { id: 'u' } },
            isPending: false,
          }
        : { data: null, isPending: true },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConvexAuthProvider
      authClient={authClient as never}
      client={client as never}
      initialToken={initialToken}
      onTokenIdentityChange={onTokenIdentityChange}
      optimisticAuth={optimisticAuth}
      tokenIdentityBaseline={baseline}
    >
      {children}
    </ConvexAuthProvider>
  );
  return { onTokenIdentityChange, ...renderHook(() => useAuth(), { wrapper }) };
};

const makeClient = () => {
  const fetchers: FetchToken[] = [];
  return {
    fetchers,
    client: {
      clearAuth: () => {},
      close: mock(async () => {}),
      setAuth: (fetchToken: FetchToken) => {
        fetchers.push(fetchToken);
      },
    },
  };
};

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe('identity guard across built entrypoints', () => {
  afterEach(() => {
    resetDocumentTripForTests();
  });

  test('a client kitcn/auth/start authenticated gets no optimistic window in kitcn/auth/client', async () => {
    const token = identityJwt('user_a', 'session_a');
    const { client } = makeClient();
    await syncConvexAuthForStartLoader({
      convex: client,
      getToken: async () => token,
    });

    const { result } = mountProvider({
      client,
      initialToken: token,
      optimisticAuth: true,
      session: 'pending',
    });
    await flush();

    expect(result.current.isAuthenticated).toBe(false);
  });

  test('the page identity from kitcn/auth/client holds kitcn/auth/start', async () => {
    const { client } = makeClient();
    mountProvider({ baseline: 'user_a|session_a', client, session: 'pending' });
    await flush();

    const fresh = makeClient();
    let state: unknown;
    await act(async () => {
      state = await syncConvexAuthForStartLoader({
        convex: fresh.client,
        getToken: async () => identityJwt('user_b', 'session_b'),
      });
    });

    expect(state).toEqual({ isAuthenticated: false, token: null });
  });

  test('a trip in kitcn/auth/client stops kitcn/auth/start', async () => {
    const tokenForA = identityJwt('user_a', 'session_a');
    const { client, fetchers } = makeClient();
    const provider = mountProvider({
      client,
      initialToken: tokenForA,
      tokens: [identityJwt('user_b', 'session_b')],
    });
    await flush();
    await act(async () => {
      await fetchers.at(-1)!({ forceRefreshToken: false });
      await fetchers.at(-1)!({ forceRefreshToken: true });
    });
    expect(provider.onTokenIdentityChange).toHaveBeenCalledTimes(1);

    const fresh = makeClient();
    let state: unknown;
    await act(async () => {
      state = await syncConvexAuthForStartLoader({
        convex: fresh.client,
        getToken: async () => tokenForA,
      });
    });

    expect(state).toEqual({ isAuthenticated: false, token: null });
  });
});
