/**
 * Pure XP math. A single fixed cubic curve over `n = level - 1`:
 *   xpForLevel(l) = A·n³ + B·n² + C·n   (total XP required to REACH level l)
 *
 * `levelForXp` is its inverse (floor level for a total), and `progressToNext`
 * the fraction of the current level's span already filled. All functions are
 * pure; no IO, no cache.
 *
 * Using `level - 1` puts level 1 at 0 XP, so new users start at level 1.
 * A polynomial keeps every level reachable: the per-level gap grows
 * roughly quadratically instead of doubling every few levels, so regulars
 * keep levelling for years rather than stalling around 50. At the default
 * 15-25 XP and 60 s cooldown the first level-up takes ~5 messages; a
 * typical member reaches ~37 in a year, and level 100 (~1.8M XP) is a
 * multi-year goal for the most active.
 */

const A = 1.6;
const B = 25;
const C = 75;

/**
 * Total XP required to reach `level`. Rounded to a whole number so
 * thresholds stay integer: they're compared against integer XP totals
 * and displayed on rank cards.
 */
export function xpForLevel(level: number): number {
  const n = level - 1;
  return Math.round(A * n ** 3 + B * n ** 2 + C * n);
}

/**
 * Floor level for a cumulative XP total (inverse of `xpForLevel`): the
 * highest `l` with `xpForLevel(l) <= xp`. Levels start at 1, so totals
 * below the level-1 threshold are still level 1.
 *
 * The cube root of the leading term overestimates the level (it ignores
 * the lower-order terms), so the correction loops walk it down to the
 * true floor; that is a handful of steps even at level 100.
 */
export function levelForXp(xp: number): number {
  let level = Math.max(1, Math.floor(Math.cbrt(xp / A)) + 1);
  while (xpForLevel(level + 1) <= xp) {
    level++;
  }
  while (xpForLevel(level) > xp) {
    level--;
  }
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
