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

/**
 * Return a random element from `variants`. The array must not be empty on
 * the call site — an empty array would yield `undefined`.
 */
export function pick<T>(variants: readonly T[]): T {
  return variants[Math.floor(Math.random() * variants.length)]!;
}
