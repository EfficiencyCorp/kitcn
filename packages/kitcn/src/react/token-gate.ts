'use client';

import { type AuthStore, decodeJwtExp } from './auth-store';
import { isDocumentTripped, isJwt } from './identity-guard-trip';

/**
 * A provider's identity admission: true to admit the token; when it refuses a
 * token of another identity it trips the document itself.
 */
export type TokenAdmission = (
  token: string,
  options: { announce: boolean }
) => boolean;

const admissions = new WeakMap<object, TokenAdmission>();

/** Called by the provider that owns `authStore`. */
export const registerTokenAdmission = (
  authStore: AuthStore,
  admission: TokenAdmission
) => {
  if (authStore.store) admissions.set(authStore.store, admission);
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
    ? admissions.get(authStore.store)
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
