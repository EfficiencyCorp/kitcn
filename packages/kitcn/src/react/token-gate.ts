'use client';

import { type AuthStore, decodeJwtExp } from './auth-store';
import {
  admitToken,
  isDocumentTripped,
  storeGuard,
  type TokenUse,
} from './identity-guard-registry';

/** `admitToken` for the provider that owns `authStore`. */
export const admitStoreToken = (
  authStore: AuthStore,
  token: string,
  options: { announce?: boolean; use: TokenUse }
) => admitToken(token, { ...options, guard: storeGuard(authStore.store) });

/**
 * Caches `token` in the store if it is admitted at this moment. Returns
 * whether it was published. `sessionSyncGraceUntil` is left as is unless given.
 */
export const publishToken = (
  authStore: AuthStore,
  token: string,
  {
    announce,
    sessionSyncGraceUntil,
    use = 'hold',
  }: {
    announce: boolean;
    sessionSyncGraceUntil?: number | null;
    use?: TokenUse;
  }
) => {
  if (!admitStoreToken(authStore, token, { announce, use })) return false;
  authStore.set('token', token);
  authStore.set('expiresAt', decodeJwtExp(token));
  if (sessionSyncGraceUntil !== undefined) {
    authStore.set('sessionSyncGraceUntil', sessionSyncGraceUntil);
  }
  return true;
};

/**
 * Publishes `isAuthenticated: true` if, at this moment, the page has not
 * tripped and the store's token is still admitted.
 */
export const publishAuthenticated = (authStore: AuthStore) => {
  const token = authStore.get('token');
  if (
    isDocumentTripped() ||
    (token && !admitStoreToken(authStore, token, { use: 'hold' }))
  ) {
    return false;
  }
  authStore.set('isAuthenticated', true);
  return true;
};

/**
 * Publishes the auth gate's state; never authenticated after a trip. The
 * loading write runs subscribers synchronously, so the held token is admitted
 * again, and the trip read again, right before an authenticated write.
 */
export const publishAuthState = (
  authStore: AuthStore,
  state: { isAuthenticated: boolean; isLoading: boolean }
) => {
  const tripped = isDocumentTripped();
  authStore.set('isLoading', tripped ? false : state.isLoading);
  if (!state.isAuthenticated || tripped) {
    authStore.set('isAuthenticated', false);
    return;
  }
  const token = authStore.get('token');
  authStore.set(
    'isAuthenticated',
    !isDocumentTripped() &&
      !(token && !admitStoreToken(authStore, token, { use: 'hold' }))
  );
};
