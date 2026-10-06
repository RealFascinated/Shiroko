import type { Cache, CacheStats } from "./cache";
import { guildScope, userScope } from "./key";

/**
 * Every cache in the process, so lifecycle events can purge by scope
 * without knowing which caches exist. Registration is process-wide and
 * permanent; a duplicate name is a programming error.
 */
export class Caches {
  private static readonly REGISTRY: Map<string, Cache<unknown>> = new Map<string, Cache<unknown>>();

  public static register<V>(cache: Cache<V>): Cache<V> {
    if (Caches.REGISTRY.has(cache.name)) {
      throw new Error(`Cache "${cache.name}" is already registered`);
    }
    Caches.REGISTRY.set(cache.name, cache as Cache<unknown>);
    return cache;
  }

  /**
   * Purge one scope from every cache. Returns the total entries dropped.
   */
  public static purgeScope(scope: string): number {
    let purged = 0;
    for (const cache of Caches.REGISTRY.values()) {
      purged += cache.purgeScope(scope);
    }
    return purged;
  }

  public static purgeGuild(guildId: string): number {
    return Caches.purgeScope(guildScope(guildId));
  }

  public static purgeUser(userId: string): number {
    return Caches.purgeScope(userScope(userId));
  }

  public static stats(): CacheStats[] {
    return Array.from(Caches.REGISTRY.values(), cache => cache.stats());
  }
}
