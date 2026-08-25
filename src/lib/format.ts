/**
 * Return a count with its noun in the correct singular or plural form.
 *
 * Words ending in "s" take "es" (e.g. "box" -> "boxes"); everything else takes
 * "s". Examples: `pluralize("hug", 1)` -> "1 hug", `pluralize("hug", 3)` -> "3 hugs".
 */
export function pluralize(word: string, count: number): string {
  const plural = /s$/.test(word) ? `${word}es` : `${word}s`;
  return `${count} ${count === 1 ? word : plural}`;
}

/** Ordinal suffixes indexed by last digit: 0th, 1st, 2nd, 3rd, 4th–9th. */
const ORDINAL_SUFFIXES = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];

/**
 * Return `n` as an ordinal string: `1st`, `2nd`, `3rd`, `4th`, ….
 * Examples: `ordinal(1)` -> "1st", `ordinal(22)` -> "22nd".
 */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ORDINAL_SUFFIXES[mod100 % 10]!;
  return `${n}${suffix}`;
}

/**
 * Leaderboard medals indexed by zero-based position: gold for 1st, silver
 * for 2nd, bronze for 3rd. The whole codebase reads from here.
 */
export const MEDALS: readonly (string | null)[] = ["🥇", "🥈", "🥉"];

/**
 * Format a 1-based leaderboard rank: medals for the top 3, `#N` beyond.
 * `null` stays `-`.
 */
export function formatRank(rank: number | null): string {
  return rank === null ? "-" : (MEDALS[rank - 1] ?? `#${rank}`);
}

/**
 * Uppercase the first letter of `word`, leaving the rest untouched.
 * Examples: `titleCase("hug")` -> "Hug", `titleCase("holdhands")` -> "Holdhands".
 */
export function titleCase(word: string): string {
  return word ? word[0]!.toUpperCase() + word.slice(1) : word;
}
