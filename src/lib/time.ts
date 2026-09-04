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
 * How long until `endsAt`, in whole milliseconds, clamped at 0.
 */
export function remainingMs(endsAt: Date, now: Date = new Date()): number {
  return Math.max(0, endsAt.getTime() - now.getTime());
}
/**
 * Format a duration in milliseconds as its largest whole units, e.g. `2d 4h 12m`.
 */
export function formatDuration(ms: number): string {
  const day = TimeUnit.toMillis(TimeUnit.Day, 1);
  const hour = TimeUnit.toMillis(TimeUnit.Hour, 1);
  const minute = TimeUnit.toMillis(TimeUnit.Minute, 1);
  const days = Math.floor(ms / day);
  const hours = Math.floor((ms % day) / hour);
  const minutes = Math.floor((ms % hour) / minute);
  const parts: string[] = [];
  if (days) {
    parts.push(`${days}d`);
  }
  if (hours) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(" ");
}
