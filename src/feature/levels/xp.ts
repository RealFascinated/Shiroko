/**
 * Pure XP math. A single fixed curve: the exponential
 *   xpForLevel(l) = BASE·(RATE^l − 1)   (total XP required to REACH level l)
 *
 * `levelForXp` is its inverse (floor level for a total), and `progressToNext`
 * the fraction of the current level's span already filled. All functions are
 * pure; no IO, no cache.
 *
 * The curve subtracts 1 so new users start at level 1 with 0 XP. Early
 * levels arrive fast (first level-up in a few minutes of chatting), then
 * each level takes noticeably longer than the last: the per-level gap
 * grows ~25× from level 2 to level 25, so mid-tier milestones like level
 * 25 are a real grind (~27 h of max-rate messaging).
 */

const BASE = 500;
const RATE = 1.15;

/**
 * Total XP required to reach `level`. Rounded to a whole number so
 * thresholds stay integer: they're compared against integer XP totals
 * and displayed on rank cards.
 */
export function xpForLevel(level: number): number {
  return Math.round(BASE * (Math.pow(RATE, level) - 1));
}

/**
 * Floor level for a cumulative XP total (inverse of `xpForLevel`): the
 * highest `l` with `xpForLevel(l) <= xp`. Levels start at 1, so totals
 * below the level-1 threshold are still level 1.
 *
 * The closed form is exact for unrounded thresholds; the rounding in
 * `xpForLevel` can shift a boundary by under 1 XP, so the correction
 * loop snaps the result back when it lands just off the true floor.
 */
export function levelForXp(xp: number): number {
  let level = Math.floor(Math.log(1 + xp / BASE) / Math.log(RATE));
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
