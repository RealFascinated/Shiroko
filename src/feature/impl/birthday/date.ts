/**
 * Pure date math for birthdays. No IO, no cache, mirroring `xp.ts` in the
 * levels feature. Every function treats dates as UTC: the feature has one
 * fixed notion of "today" (00:01 UTC) for every guild, so reading local
 * components anywhere would shift a birthday across a day boundary.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_YEAR = 1900;

/**
 * Whether `(year, month, day)` is a real calendar date. Round-trips through
 * `Date.UTC` and checks the components survive: `31 2`, `30 2`, and `29 2`
 * in a non-leap year all overflow into the next month and are rejected,
 * while a real leap day is accepted.
 */
export function isValidBirthDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Whether `year` is a plausible birth year: not in the future and not
 * absurdly far back, using the current UTC year as the ceiling.
 */
export function isValidBirthYear(year: number, now: Date = new Date()): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= now.getUTCFullYear();
}

/**
 * Today's month and day in UTC, as the sweep and `upcoming` both use it.
 */
export function todayUtc(now: Date = new Date()): { month: number; day: number } {
  return { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
}

/**
 * Whole years since `birthDate`, counting a birthday that has not yet
 * arrived this year as not yet gained.
 */
export function ageInYears(birthDate: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age--;
  }
  return age;
}

/**
 * Days from `from` until the next occurrence of `(month, day)`, in UTC.
 * `0` means today. A 29 February birthday is only ever observed in leap
 * years, so the search walks forward until it finds a year where the date
 * actually exists rather than rolling to 1 March: the sweep matches
 * `(2, 29)` exactly, and this must agree with it.
 */
export function daysUntil(month: number, day: number, from: Date = new Date()): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  for (let yearOffset = 0; yearOffset <= 8; yearOffset++) {
    const candidate = Date.UTC(from.getUTCFullYear() + yearOffset, month - 1, day);
    const resolved = new Date(candidate);
    // An overflowing date (29 Feb in a common year) rolls into the next
    // month; only accept the year where it lands on the requested month/day.
    if (resolved.getUTCMonth() !== month - 1 || resolved.getUTCDate() !== day) {
      continue;
    }
    if (candidate >= start) {
      return Math.round((candidate - start) / DAY_MS);
    }
  }
  return 0;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Month name for a 1-based month number, for display.
 */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}
