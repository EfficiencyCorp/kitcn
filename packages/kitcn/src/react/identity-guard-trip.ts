// Document-wide identity state for the token identity guard, browser only: it
// is never set on the server, where one module serves many requests, and a
// reload clears it. No React or store imports, so loaders can use it too.
//
// - The trip: once any guard refuses a token of another identity, every
//   mounted provider publishes unauthenticated and hands out no token, and
//   providers, clients and loaders created later start tripped.
// - The document identity: the first identity a guard admits, so a token
//   handed out without a provider (the Start loader) is held to it.
let tripped = false;
let documentIdentity: string | null = null;
const listeners = new Set<() => void>();
const inBrowser = () => typeof window !== 'undefined';

export const isDocumentTripped = () => tripped;

export const tripDocument = () => {
  if (!inBrowser() || tripped) return;
  tripped = true;
  for (const listener of [...listeners]) listener();
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
 * trip, and only for the identity the document already admitted, if any.
 */
export const admitsDocumentToken = (token: string) => {
  if (tripped) return false;
  return (
    documentIdentity === null || decodeTokenIdentity(token) === documentIdentity
  );
};

/**
 * The user and session a Better Auth Convex JWT speaks for (`sub` and
 * `sessionId`), or null. Other claims (name, email, updatedAt) may change
 * within one session and do not count.
 */
export function decodeTokenIdentity(token: string | null): string | null {
  if (!token) return null;
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const payload: unknown = JSON.parse(
      atob(segment.replaceAll('-', '+').replaceAll('_', '/'))
    );
    if (typeof payload !== 'object' || payload === null) return null;
    const sub = 'sub' in payload ? payload.sub : null;
    const sessionId = 'sessionId' in payload ? payload.sessionId : null;
    if (typeof sub !== 'string') return null;
    return `${sub}|${typeof sessionId === 'string' ? sessionId : ''}`;
  } catch {
    return null;
  }
}

/** Test-only: clear the trip and the document identity between tests. */
export const resetDocumentTripForTests = () => {
  tripped = false;
  documentIdentity = null;
};
