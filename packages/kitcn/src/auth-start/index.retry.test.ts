import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

describe('auth/start token refresh', () => {
  afterEach(() => {
    mock.restore();
  });

  test('retries with a fresh token when cached auth fails', async () => {
    const query = mock(async function (
      this: { token?: string },
      _ref: unknown
    ) {
      if (this.token === 'stale-token') {
        const error = new Error('unauthorized');
        (error as Error & { code?: string }).code = 'UNAUTHORIZED';
        throw error;
      }
      return 'ok';
    });

    // Spy on the real client: mock.module('convex/browser') is process-global
    // and would leak a stub ConvexHttpClient into later test files.
    const proto = ConvexHttpClient.prototype as unknown as Record<
      'action' | 'mutation' | 'query' | 'setAuth' | 'setFetchOptions',
      (...args: any[]) => any
    >;
    spyOn(proto, 'setAuth').mockImplementation(function (
      this: { token?: string },
      token: string
    ) {
      this.token = token;
    });
    spyOn(proto, 'setFetchOptions').mockImplementation(() => {});
    for (const method of ['query', 'mutation', 'action'] as const) {
      spyOn(proto, method).mockImplementation(function (
        this: { token?: string },
        ref: unknown
      ) {
        return query.call(this, ref);
      });
    }

    const getToken = mock(async (_siteUrl: string, _headers: Headers) => {
      if (getToken.mock.calls.length === 1) {
        return { isFresh: false, token: 'stale-token' };
      }
      return { isFresh: true, token: 'fresh-token' };
    });

    mock.module('../auth/internal/token', () => ({
      getToken,
    }));

    const request = new Request('https://app.example.com/');
    mock.module('@tanstack/react-start/server', () => ({
      getRequest: () => request,
      getRequestHeaders: () => request.headers,
    }));

    const serverMutation = mock(
      async (_ref: unknown, _args: unknown, options?: { token?: string }) => {
        if (options?.token === 'stale-token') {
          const error = new Error('unauthorized');
          (error as Error & { code?: string }).code = 'UNAUTHORIZED';
          throw error;
        }
        return 'ok';
      }
    );

    mock.module('convex/nextjs', () => ({
      fetchAction: serverMutation,
      fetchMutation: serverMutation,
      fetchQuery: serverMutation,
    }));

    const mutationRef = makeFunctionReference<'mutation'>('todos:create');
    const api = {
      todos: {
        create: Object.assign(mutationRef, {
          functionRef: mutationRef,
          type: 'mutation',
        }),
      },
    } as const;

    const { convexBetterAuthReactStart } = await import('./server');

    const auth = convexBetterAuthReactStart({
      api,
      auth: {
        isUnauthorized: (error) =>
          (error as { code?: string } | undefined)?.code === 'UNAUTHORIZED',
      },
      convexSiteUrl: 'https://app.convex.site',
      convexUrl: 'https://app.convex.cloud',
    });

    const caller = auth.createCaller();
    await expect(caller.getToken()).resolves.toBe('stale-token');
    await expect(auth.fetchAuthQuery({} as never)).resolves.toBe('ok');
    await expect(caller.todos.create({})).resolves.toBe('ok');

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(2);
    expect(serverMutation).toHaveBeenCalledTimes(1);
  });
});
