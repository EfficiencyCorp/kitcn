import type { ConvexReactClient } from 'convex/react';
import { pageRegistry } from '../react/identity-guard-registry';

// A Convex client's optimistic window ends at its first auth result: the
// value Convex reports through the `onChange` it is given in `setAuth`. It is
// recorded there, not in a React effect, so a result reported just before an
// unmount still counts, every provider over the client hears it, and a local
// session change (which reports nothing) does not.
// The wrapper is installed by the first provider with `optimisticAuth` over a
// client; results reported before that are not seen. The state lives in the
// page registry shared by every built entry (the Start loader settles clients
// too); on the server nothing is recorded.

/** Wraps the client's `setAuth` once, so every `onChange` records settlement. */
export function watchClientSettlement(client: ConvexReactClient) {
  const registry = pageRegistry();
  if (!registry || registry.watchedClients.has(client)) return;
  registry.watchedClients.add(client);
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
  const registry = pageRegistry();
  if (!registry || registry.settledClients.has(client)) return;
  registry.settledClients.add(client);
  for (const listener of [
    ...(registry.settlementListeners.get(client) ?? []),
  ]) {
    listener();
  }
}

export const isClientSettled = (client: object) =>
  pageRegistry()?.settledClients.has(client) ?? false;

export const subscribeClientSettlement = (
  client: object,
  listener: () => void
) => {
  const registry = pageRegistry();
  if (!registry) return () => {};
  let clientListeners = registry.settlementListeners.get(client);
  if (!clientListeners) {
    clientListeners = new Set();
    registry.settlementListeners.set(client, clientListeners);
  }
  clientListeners.add(listener);
  return () => {
    clientListeners.delete(listener);
  };
};
