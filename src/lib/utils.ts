/**
 * Return a random element from `variants`. The array must not be empty on
 * the call site. An empty array would yield `undefined`.
 */
export function pick<T>(variants: readonly T[]): T {
  return variants[Math.floor(Math.random() * variants.length)]!;
}

/**
 * Return the first element of `items`, or throw if it has none.
 *
 * The caller is expected to provide a non-empty array. An empty one is a
 * programming/upstream error, not a normal case.
 */
export function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (!item) {
    throw new Error("expected at least one item");
  }
  return item;
}
