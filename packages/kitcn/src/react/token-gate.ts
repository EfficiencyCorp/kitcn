'use client';

import { type AuthStore, decodeJwtExp } from './auth-store';
import {
  identityGuardRegistry,
  type TokenAdmission,
} from './identity-guard-registry';
import { isDocumentTripped, isJwt } from './identity-guard-trip';

export type { TokenAdmission } from './identity-guard-registry';

/** Called by the provider that owns `authStore`. */
export const registerTokenAdmission = (
  authStore: AuthStore,
  admission: TokenAdmission
) => {
  if (authStore.store) {
    identityGuardRegistry().admissions.set(authStore.store, admission);
  }
};

/**
 * The one check every token passes at the moment it is cached, published or
 * handed out: the document trip first (whatever the provider's options), then
 * the provider's identity admission. An opaque session token is only an
 * exchange credential, never handed to Convex, so only the trip applies to it;
 * the JWT it is exchanged for is admitted in turn.
 */
export const admitToken = (
  authStore: AuthStore,
  token: string,
  { announce }: { announce: boolean }
) => {
  if (isDocumentTripped()) return false;
  if (!isJwt(token)) return true;
  const admission = authStore.store
    ? identityGuardRegistry().admissions.get(authStore.store)
    : undefined;
  return admission ? admission(token, { announce }) : true;
};

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
  }: { announce: boolean; sessionSyncGraceUntil?: number | null }
) => {
  if (!admitToken(authStore, token, { announce })) return false;
  // `onTokenIdentityAdmitted` ran inside the admission and may have tripped
  // the page: nothing is written after a trip.
  if (isDocumentTripped()) return false;
  authStore.set('token', token);
  authStore.set('expiresAt', decodeJwtExp(token));
  if (sessionSyncGraceUntil !== undefined) {
    authStore.set('sessionSyncGraceUntil', sessionSyncGraceUntil);
  }
  return true;
};

/**
 * Publishes `isAuthenticated: true` if, at this moment, the document has not
 * tripped and the store's token is still admitted (a guard whose document
 * moved to another identity refuses it and trips the document).
 */
export const publishAuthenticated = (authStore: AuthStore) => {
  if (isDocumentTripped()) return false;
  const token = authStore.get('token');
  if (token && !admitToken(authStore, token, { announce: false })) {
    return false;
  }
  authStore.set('isAuthenticated', true);
  return true;
};

/** Publishes the auth gate's state; never authenticated after a trip. */
export const publishAuthState = (
  authStore: AuthStore,
  state: { isAuthenticated: boolean; isLoading: boolean }
) => {
  const tripped = isDocumentTripped();
  authStore.set('isLoading', tripped ? false : state.isLoading);
  authStore.set('isAuthenticated', tripped ? false : state.isAuthenticated);
};
