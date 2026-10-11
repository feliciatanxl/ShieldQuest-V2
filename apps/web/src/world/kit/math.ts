// Pure maths shared by the kit (no React, no DOM), so geometry builders stay testable in Node.

export type Vec3 = [number, number, number];

export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
/** Smooth 0..1..0 bump. */
export const bump = (t: number) => Math.sin(clamp(t) * Math.PI);

/** Frame-rate independent smoothing factor for `lerp(current, target, damp(rate, delta))`. */
export const damp = (rate: number, delta: number) => 1 - Math.exp(-rate * Math.min(delta, 0.1));

/** Deterministic 32-bit hash for strings (cast ids, seeds) so idle phases and picks are stable. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32): same seed, same scenery, on every device. */
export function seededRandom(seed: number | string): () => number {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks one item deterministically from a seed. */
export function pick<T>(items: readonly T[], seed: number | string): T {
  const r = seededRandom(seed)();
  return items[Math.min(items.length - 1, Math.floor(r * items.length))] as T;
}
