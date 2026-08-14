/**
 * src/sim/rng.ts — seeded PRNG. Sim results must be reproducible from a seed,
 * or a strategy comparison is just noise.
 */

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** integer in [0, n) */
  int(n: number): number;
  pick<T>(xs: readonly T[]): T;
}

/** mulberry32 — small, fast, adequate for move selection. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new Error("pick from empty array");
      return xs[Math.floor(next() * xs.length)]!;
    },
  };
}
