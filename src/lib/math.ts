/**
 * Clamp `value` so it stays within `[min, max]`. Falls back to the bound it
 * crosses; assumes `min <= max`.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
