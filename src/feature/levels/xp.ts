/**
 * Pure XP curve math. A curve is one quadratic:
 *   xpForLevel(l) = a·l² + b·l + c   (total XP required to REACH level l)
 *
 * `levelForXp` is its inverse (floor level for a total), and `xpForNext`
 * the delta to the next level. All functions are pure; no IO, no cache.
 *
 * All presets set `c = 0` so new users start at level 1 with 0 XP. The
 * first level-up arrives after a few messages instead of a long silent
 * stretch.
 */

export type XpCurve = "normal" | "easy" | "hard";

/** Quadratic coefficients per curve preset. */
export const CURVE_COEFFICIENTS: Record<XpCurve, { a: number; b: number; c: number }> = {
  normal: { a: 5, b: 50, c: 0 },
  easy: { a: 3, b: 30, c: 0 },
  hard: { a: 8, b: 80, c: 0 },
};

export const DEFAULT_CURVE: XpCurve = "normal";

export function isXpCurve(value: string): value is XpCurve {
  return value === "normal" || value === "easy" || value === "hard";
}

/**
 * Total XP required to reach `level` on `curve`.
 */
export function xpForLevel(level: number, curve: XpCurve = DEFAULT_CURVE): number {
  const { a, b, c } = CURVE_COEFFICIENTS[curve];
  return a * level * level + b * level + c;
}

/**
 * XP required to advance from `level` to `level + 1` on `curve`.
 */
export function xpForNext(level: number, curve: XpCurve = DEFAULT_CURVE): number {
  return xpForLevel(level + 1, curve) - xpForLevel(level, curve);
}

/**
 * Floor level for a cumulative XP total on `curve` (inverse of
 * `xpForLevel`): the highest `l` with `xpForLevel(l) <= xp`. Levels start
 * at 1, so totals below the level-1 threshold are still level 1.
 */
export function levelForXp(xp: number, curve: XpCurve = DEFAULT_CURVE): number {
  const { a, b, c } = CURVE_COEFFICIENTS[curve];
  const root = Math.sqrt(b * b - 4 * a * (c - xp));
  const level = Math.floor((-b + root) / (2 * a));
  return Math.max(1, level);
}

/**
 * How much of the current level's span has been filled, 0..1, for a
 * progress bar. `0` at exactly the threshold, `1` just before the next.
 */
export function progressToNext(xp: number, curve: XpCurve = DEFAULT_CURVE): number {
  const level = levelForXp(xp, curve);
  const current = xpForLevel(level, curve);
  const next = xpForLevel(level + 1, curve);
  return Math.min(1, Math.max(0, (xp - current) / (next - current)));
}
