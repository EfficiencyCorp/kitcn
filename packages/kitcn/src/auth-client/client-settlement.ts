import type { ConvexReactClient } from 'convex/react';

// A Convex client's optimistic window ends at its first auth result: the
// value Convex reports through the `onChange` it is given in `setAuth`. It is
// recorded there, not in a React effect, so a result reported just before an
// unmount still counts, every provider over the client hears it, and a local
// session change (which reports nothing) does not.
// The wrapper is installed by the first provider with `optimisticAuth` over a
// client; results reported before that are not seen.
const settledClients = new WeakSet<object>();
const listeners = new WeakMap<object, Set<() => void>>();
const watchedClients = new WeakSet<object>();

/** Wraps the client's `setAuth` once, so every `onChange` records settlement. */
export function watchClientSettlement(client: ConvexReactClient) {
  if (watchedClients.has(client)) return;
  watchedClients.add(client);
  const setAuth = client.setAuth.bind(client);
  client.setAuth = (fetchToken, onChange, onRefreshChange) =>
    setAuth(
      fetchToken,
      (isAuthenticated) => {
        settleClient(client);
        onChange?.(isAuthenticated);
      },
      onRefreshChange
    );
}

/**
 * Marks the client settled: its optimistic window is over, or never opens.
 * The Start loader calls it when it sets auth before any provider renders.
 */
export function settleClient(client: object) {
  if (settledClients.has(client)) return;
  settledClients.add(client);
  for (const listener of [...(listeners.get(client) ?? [])]) listener();
}

export const isClientSettled = (client: object) => settledClients.has(client);

export const subscribeClientSettlement = (
  client: object,
  listener: () => void
) => {
  let clientListeners = listeners.get(client);
  if (!clientListeners) {
    clientListeners = new Set();
    listeners.set(client, clientListeners);
  }
  clientListeners.add(listener);
  return () => {
    clientListeners.delete(listener);
  };
};
