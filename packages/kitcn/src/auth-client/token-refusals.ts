import { decodeJwtExp } from '../react/auth-store';

/**
 * Tokens Convex refused, for the optimistic gate. Convex's client retries an
 * auth error on its own (it refetches and re-authenticates) before it reports
 * one refusal, so every token handed to Convex since its last confirmation is
 * pending, and a refusal covers all of them. Expired entries are pruned on
 * every insert, and at most `limit` are kept, oldest out.
 */
export class TokenRefusals {
  static readonly limit = 16;

  private readonly pending = new Set<string>();
  private readonly refusedTokens = new Set<string>();

  /** A token was handed to Convex. */
  submitted(token: string) {
    this.pending.delete(token);
    this.pending.add(token);
    prune(this.pending);
  }

  /** Convex confirmed the auth it holds. */
  confirmed() {
    this.pending.clear();
  }

  /** Convex refused: every token handed out since the last confirmation. */
  refused() {
    for (const token of this.pending) {
      this.refusedTokens.delete(token);
      this.refusedTokens.add(token);
    }
    this.pending.clear();
    prune(this.refusedTokens);
  }

  has(token: string) {
    return this.refusedTokens.has(token);
  }

  get size() {
    return this.refusedTokens.size;
  }
}

function prune(tokens: Set<string>) {
  const now = Date.now();
  for (const token of tokens) {
    const expiresAt = decodeJwtExp(token);
    if (expiresAt !== null && expiresAt <= now) tokens.delete(token);
  }
  for (const token of tokens) {
    if (tokens.size <= TokenRefusals.limit) break;
    tokens.delete(token);
  }
}
