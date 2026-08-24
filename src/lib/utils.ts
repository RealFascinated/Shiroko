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
