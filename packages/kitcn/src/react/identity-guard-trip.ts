// Document-wide identity state for the token identity guard, browser only: it
// is never set on the server, where one module serves many requests, and a
// reload clears it. No React or store imports, so loaders can use it too.
//
// - The trip: once any guard refuses a token of another identity, every
//   mounted provider publishes unauthenticated and hands out no token, and
//   providers, clients and loaders created later start tripped.
// - The document identity: the first identity a guard knows (from its
//   baseline, its held SSR token or its first admitted token), so a token
//   handed out without a provider (the Start loader) is held to it.
let tripped = false;
let documentIdentity: string | null = null;
const listeners = new Set<() => void>();
const inBrowser = () => typeof window !== 'undefined';

export const isDocumentTripped = () => tripped;

export const tripDocument = () => {
  if (!inBrowser() || tripped) return;
  tripped = true;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      // One subscriber failing must not stop the others.
      console.error('[kitcn] identity guard trip listener threw', error);
    }
  }
};

export const subscribeDocumentTrip = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Records the identity a guard admitted, if none is recorded yet. */
export const recordDocumentIdentity = (identity: string) => {
  if (inBrowser()) documentIdentity ??= identity;
};

/**
 * Whether a token handed out outside a provider may be used: never after a
 * trip, and only for the identity the document already knows, if any. A
 * token of another identity trips the document.
 */
export const admitDocumentToken = (token: string) => {
  if (tripped) return false;
  if (
    documentIdentity === null ||
    decodeTokenIdentity(token) === documentIdentity
  ) {
    return true;
  }
  tripDocument();
  return false;
};

/** A JWT's payload: three segments whose middle one is a JSON object. */
function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length !== 3 || !segments[1]) return null;
  try {
    const payload: unknown = JSON.parse(
      atob(segments[1].replaceAll('-', '+').replaceAll('_', '/'))
    );
    return typeof payload === 'object' &&
      payload !== null &&
      !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether a token is a JWT, by structure and whatever its `exp`: every JWT
 * goes through identity admission; only other strings (opaque session
 * tokens) are exchange credentials.
 */
export const isJwt = (token: string) => decodeJwtClaims(token) !== null;

/**
 * The user and session a Better Auth Convex JWT speaks for (`sub` and
 * `sessionId`), or null. Other claims (name, email, updatedAt) may change
 * within one session and do not count.
 */
export function decodeTokenIdentity(token: string | null): string | null {
  const claims = token ? decodeJwtClaims(token) : null;
  if (!claims || typeof claims.sub !== 'string') return null;
  const sessionId =
    typeof claims.sessionId === 'string' ? claims.sessionId : '';
  return `${claims.sub}|${sessionId}`;
}

/** Test-only: clear the trip and the document identity between tests. */
export const resetDocumentTripForTests = () => {
  tripped = false;
  documentIdentity = null;
};
