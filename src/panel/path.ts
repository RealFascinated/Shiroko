export function getPath(root: unknown, path: string): unknown {
  let current = root;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * An immutable write of a dotted path: every object along the path is
 * copied, so the returned value shares nothing that changed with the
 * input. Paths are only ever built from `PanelControl` keys, which are
 * leaf paths of a plain object, so the parents always exist.
 */
export function setPath<T>(root: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const clone = { ...(root as Record<string, unknown>) };
  clone[head!] = rest.length === 0 ? value : setPath(clone[head!], rest.join("."), value);
  return clone as T;
}
