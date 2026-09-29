'use client';

// A tripped identity guard quarantines the whole document, browser only: every
// mounted provider publishes terminal unauthenticated and answers null, a
// provider or Convex client created later starts tripped, and sign-in
// mutations fail. It is never set on the server, where one module serves many
// requests. A reload clears it.
let tripped = false;
const listeners = new Set<() => void>();

export const isDocumentTripped = () => tripped;

export const tripDocument = () => {
  if (typeof window === 'undefined' || tripped) return;
  tripped = true;
  for (const listener of [...listeners]) listener();
};

export const subscribeDocumentTrip = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Test-only: clear the document trip between tests. */
export const resetDocumentTripForTests = () => {
  tripped = false;
};
