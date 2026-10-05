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

/**
 * Build a record from a list of keys by mapping each key to a value. The
 * key union is preserved, so the result is `Record<K, O>` and not a loose
 * string index.
 */
export function mapKeys<K extends string, O>(keys: readonly K[], value: (key: K) => O): Record<K, O> {
  return Object.fromEntries(keys.map(key => [key, value(key)])) as Record<K, O>;
}

/**
 * Map every key of a lookup table to a value, preserving the key union.
 */
export function mapRecord<K extends string, I, O>(
  source: Record<K, I>,
  value: (key: K, entry: I) => O
): Record<K, O> {
  return mapKeys(Object.keys(source) as K[], key => value(key, source[key]));
}
