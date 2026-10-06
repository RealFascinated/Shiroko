/** Ordinal suffixes indexed by last digit: 0th, 1st, 2nd, 3rd, 4th-9th. */
const ORDINAL_SUFFIXES = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];

export function ordinal(n: number): string {
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ORDINAL_SUFFIXES[mod100 % 10]!;
  return `${n}${suffix}`;
}

export function pluralise(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

/**
 * Uppercase the first letter of `word`, leaving the rest untouched.
 * Examples: `titleCase("hug")` -> "Hug", `titleCase("holdhands")` -> "Holdhands".
 */
export function titleCase(word: string): string {
  return word ? word[0]!.toUpperCase() + word.slice(1) : word;
}

export function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
