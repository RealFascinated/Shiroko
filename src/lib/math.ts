/**
 * Clamp `value` so it stays within `[min, max]`. Falls back to the bound it
 * crosses; assumes `min <= max`.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Random integer in `[min, max]`, inclusive on both ends.
 */
export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Random integer within `range: [min, max]`, inclusive on both ends.
 */
export function randIntRange(range: readonly [number, number]): number {
  return randInt(range[0], range[1]);
}
