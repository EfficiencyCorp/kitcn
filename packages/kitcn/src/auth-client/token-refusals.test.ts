import { TokenRefusals } from './token-refusals';

const jwt = (expSecondsFromNow: number, nonce: string) =>
  `x.${btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
      nonce,
    })
  )}.z`;

describe('TokenRefusals', () => {
  test('a refusal covers every token handed out since the last confirmation', () => {
    const refusals = new TokenRefusals();
    const [a, b, c] = [jwt(3600, 'a'), jwt(3600, 'b'), jwt(3600, 'c')];
    refusals.submitted(a);
    refusals.confirmed();
    refusals.submitted(b);
    refusals.submitted(c);
    refusals.refused();

    expect(refusals.has(a)).toBe(false);
    expect(refusals.has(b)).toBe(true);
    expect(refusals.has(c)).toBe(true);
  });

  test('prunes expired tokens on every insert', () => {
    const refusals = new TokenRefusals();
    const expired = jwt(-10, 'expired');
    refusals.submitted(expired);
    refusals.refused();
    refusals.submitted(jwt(3600, 'live'));
    refusals.refused();

    expect(refusals.has(expired)).toBe(false);
    expect(refusals.size).toBe(1);
  });

  test('keeps at most a small number of refusals, oldest out', () => {
    const refusals = new TokenRefusals();
    const tokens = Array.from({ length: 40 }, (_, index) =>
      jwt(3600, String(index))
    );
    for (const token of tokens) {
      refusals.submitted(token);
      refusals.refused();
    }

    expect(refusals.size).toBe(TokenRefusals.limit);
    expect(refusals.has(tokens[0]!)).toBe(false);
    expect(refusals.has(tokens.at(-1)!)).toBe(true);
  });
});
