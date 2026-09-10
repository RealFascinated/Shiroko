/**
 * Pure XP math. A single fixed curve: the quadratic
 *   xpForLevel(l) = a·l² + b·l + c   (total XP required to REACH level l)
 *
 * `levelForXp` is its inverse (floor level for a total), and `progressToNext`
 * the fraction of the current level's span already filled. All functions are
 * pure; no IO, no cache.
 *
 * The curve uses `c = 0` so new users start at level 1 with 0 XP. The
 * first level-up arrives after a few messages instead of a long silent
 * stretch.
 */

const A = 5;
const B = 50;
const C = 0;

/**
 * Total XP required to reach `level`.
 */
export function xpForLevel(level: number): number {
  return A * level * level + B * level + C;
}

/**
 * Floor level for a cumulative XP total (inverse of `xpForLevel`): the
 * highest `l` with `xpForLevel(l) <= xp`. Levels start at 1, so totals
 * below the level-1 threshold are still level 1.
 */
export function levelForXp(xp: number): number {
  const root = Math.sqrt(B * B - 4 * A * (C - xp));
  const level = Math.floor((-B + root) / (2 * A));
  return Math.max(1, level);
}

/**
 * How much of the current level's span has been filled, 0..1, for a
 * progress bar. `0` at exactly the threshold, `1` just before the next.
 */
export function progressToNext(xp: number): number {
  const level = levelForXp(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return Math.min(1, Math.max(0, (xp - current) / (next - current)));
}
