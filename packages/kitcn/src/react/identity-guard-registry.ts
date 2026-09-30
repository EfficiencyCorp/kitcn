// State the token identity guard shares across kitcn's built entries.
// `kitcn/auth/start` is bundled apart from `kitcn/auth/client` and
// `kitcn/react`, so module-level state would exist once per bundle; one
// registry on `globalThis` is shared by every copy. No imports, so loaders
// can use it too.

export type TokenAdmission = (
  token: string,
  options: { announce: boolean }
) => boolean;

export type IdentityGuardRegistry = {
  /** A token of another identity was refused somewhere in the page. */
  tripped: boolean;
  tripListeners: Set<() => void>;
  /** The first identity a guard knows, held by tokens used outside a provider. */
  documentIdentity: string | null;
  /** `tokenIdentityBaseline` getters of mounted providers. */
  identitySources: Set<() => string | null>;
  /** Convex clients that reported an auth result (or the Start loader set). */
  settledClients: WeakSet<object>;
  settlementListeners: WeakMap<object, Set<() => void>>;
  /** Clients whose `setAuth` records settlement. */
  watchedClients: WeakSet<object>;
  /** Identity admission per auth store. */
  admissions: WeakMap<object, TokenAdmission>;
};

const REGISTRY_KEY = Symbol.for('kitcn.identityGuard.v1');

export const identityGuardRegistry = (): IdentityGuardRegistry => {
  const scope = globalThis as unknown as Record<
    symbol,
    IdentityGuardRegistry | undefined
  >;
  scope[REGISTRY_KEY] ??= {
    admissions: new WeakMap(),
    documentIdentity: null,
    identitySources: new Set(),
    settledClients: new WeakSet(),
    settlementListeners: new WeakMap(),
    tripListeners: new Set(),
    tripped: false,
    watchedClients: new WeakSet(),
  };
  return scope[REGISTRY_KEY];
};
