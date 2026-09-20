/**
 * Enum representing different time units.
 */
export enum TimeUnit {
  Millisecond = "millisecond",
  Second = "second",
  Minute = "minute",
  Hour = "hour",
  Day = "day",
  Week = "week",
  Month = "month",
  Year = "year",
}

/** A quantity of a single time unit, e.g. `{ unit: TimeUnit.Hour, value: 2 }`. */
export type TimeUnitValue = {
  unit: TimeUnit;
  value: number;
};

/**
 * Namespace for TimeUnit methods.
 */
export namespace TimeUnit {
  const MULTIPLIERS: Record<TimeUnit, number> = {
    [TimeUnit.Millisecond]: 1,
    [TimeUnit.Second]: 1000,
    [TimeUnit.Minute]: 60 * 1000,
    [TimeUnit.Hour]: 60 * 60 * 1000,
    [TimeUnit.Day]: 24 * 60 * 60 * 1000,
    [TimeUnit.Week]: 7 * 24 * 60 * 60 * 1000,
    [TimeUnit.Month]: 30 * 24 * 60 * 60 * 1000,
    [TimeUnit.Year]: 365 * 24 * 60 * 60 * 1000,
  };

  /**
   * Convert `value` of `unit` to milliseconds.
   */
  export function toMillis(unit: TimeUnit, value: number): number {
    return value * MULTIPLIERS[unit];
  }

  /**
   * Convert `value` of `unit` to seconds.
   */
  export function toSeconds(unit: TimeUnit, value: number): number {
    return toMillis(unit, value) / 1000;
  }
}

/**
 * Formats a duration in the format "Xd, Xh, Xm, Xs"
 * showing at most two units for simplicity.
 *
 * @param ms - Duration in milliseconds
 * @param long - Use long unit names ("Days" instead of "d")
 * @returns The formatted duration
 */
export function formatDuration(ms: number, long: boolean = false): string {
  let remaining = Math.floor(Math.abs(ms));
  const dayMs = TimeUnit.toMillis(TimeUnit.Day, 1);
  const hourMs = TimeUnit.toMillis(TimeUnit.Hour, 1);
  const minuteMs = TimeUnit.toMillis(TimeUnit.Minute, 1);
  const secondMs = TimeUnit.toMillis(TimeUnit.Second, 1);
  const days = Math.floor(remaining / dayMs);
  remaining %= dayMs;
  const hours = Math.floor(remaining / hourMs);
  remaining %= hourMs;
  const minutes = Math.floor(remaining / minuteMs);
  remaining %= minuteMs;
  const seconds = Math.floor(remaining / secondMs);
  remaining %= secondMs;
  const units = [
    { value: days, unit: long ? "Days" : "d" },
    { value: hours, unit: long ? "Hours" : "h" },
    { value: minutes, unit: long ? "Minutes" : "m" },
    { value: seconds, unit: long ? "Seconds" : "s" },
    { value: remaining, unit: long ? "Milliseconds" : "ms" },
  ];
  const result = units
    .filter(unit => unit.value > 0)
    .slice(0, 2)
    .map(unit => `${unit.value}${unit.unit}`);
  return result.join(", ") || (long ? "0 Seconds" : "0s");
}

/**
 * A `Date` shifted back by `seconds`, used to enforce message-XP cooldowns
 * in SQL (the stored timestamp must be older than this).
 */
export function nowMinus(seconds: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - seconds * 1000);
}

const DURATION_UNIT_MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: TimeUnit.toMillis(TimeUnit.Second, 1),
  m: TimeUnit.toMillis(TimeUnit.Minute, 1),
  h: TimeUnit.toMillis(TimeUnit.Hour, 1),
  d: TimeUnit.toMillis(TimeUnit.Day, 1),
  w: TimeUnit.toMillis(TimeUnit.Week, 1),
};

/**
 * Parse a compact duration string like `"90s"`, `"2d"`, `"1h30m"` into
 * milliseconds. Units may repeat and may appear in any order; a bare
 * number is treated as milliseconds, matching `formatDuration`'s short
 * unit letters (`ms`, `s`, `m`, `h`, `d`, `w`). Returns `null` for empty,
 * non-negative-integer, or unknown-unit input.
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const pattern = /(\d+)(ms|s|m|h|d|w)?/g;
  let total = 0;
  let matchedLength = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(trimmed)) !== null) {
    const value = Number(match[1]);
    const unit = match[2] ?? "ms";
    total += value * DURATION_UNIT_MULTIPLIERS[unit]!;
    matchedLength += match[0].length;
  }
  if (matchedLength !== trimmed.length) {
    return null;
  }
  return total;
}
