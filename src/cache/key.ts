/**
 * A scope tag, e.g. `guild:123` or `user:456`. Purging matches entries by
 * tag, so one lifecycle operation can drop every cache entry belonging to
 * a guild or a user without knowing which caches exist.
 */
export type ScopeTag = string;

/**
 * A cache key: the string the entry is stored under, plus every scope it
 * belongs to. Entries can carry more than one tag (a guild user belongs to
 * both its guild and its user), which is what makes "purge everything for
 * this user" work across every cache at once.
 */
export interface CacheKey {
  readonly key: string;
  readonly scopes: readonly ScopeTag[];
}

export function guildKey(guildId: string, ...parts: readonly (string | number)[]): CacheKey {
  return { key: `guild:${guildId}|${parts.join("|")}`, scopes: [`guild:${guildId}`] };
}

export function userKey(userId: string, ...parts: readonly (string | number)[]): CacheKey {
  return { key: `user:${userId}|${parts.join("|")}`, scopes: [`user:${userId}`] };
}

export function guildScope(guildId: string): ScopeTag {
  return `guild:${guildId}`;
}

export function userScope(userId: string): ScopeTag {
  return `user:${userId}`;
}
