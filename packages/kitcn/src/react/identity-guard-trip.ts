'use client';

import type { AuthStore } from './auth-store';

// A tripped identity guard quarantines the document for its lifetime, not only
// the provider that tripped: a later provider over the same Convex client
// starts tripped, and auth mutations on a tripped store publish nothing.
const trippedClients = new WeakSet<object>();
const trippedStores = new WeakSet<object>();

export const markIdentityGuardTripped = (
  client: object,
  authStore: AuthStore
) => {
  trippedClients.add(client);
  markAuthStoreTripped(authStore);
};

export const markAuthStoreTripped = (authStore: AuthStore) => {
  if (authStore.store) trippedStores.add(authStore.store);
};

export const isClientTripped = (client: object) => trippedClients.has(client);

export const isAuthStoreTripped = (authStore: AuthStore) =>
  !!authStore.store && trippedStores.has(authStore.store);
