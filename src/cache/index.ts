import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import GuildLeftEvent from "../event/events/guild-left.event";
import type { Cache, CacheStats } from "./cache";
import { guildScope, userScope } from "./key";

/**
 * Every cache in the process, so lifecycle events can purge by scope
 * without knowing which caches exist. Registration is process-wide and
 * permanent; a duplicate name is a programming error.
 */
export class Caches {
  private static readonly REGISTRY = new Map<string, Cache<unknown>>();

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

  /** Purge every entry belonging to a guild, across every cache. */
  public static purgeGuild(guildId: string): number {
    return Caches.purgeScope(guildScope(guildId));
  }

  /** Purge every entry belonging to a user, across every cache. */
  public static purgeUser(userId: string): number {
    return Caches.purgeScope(userScope(userId));
  }

  public static stats(): CacheStats[] {
    return Array.from(Caches.REGISTRY.values(), cache => cache.stats());
  }
}

/** Drops cached data for guilds the bot is no longer in. */
export class CacheListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(GuildLeftEvent)
  public async onGuildLeft(event: GuildLeftEvent): Promise<void> {
    const purged = Caches.purgeGuild(event.guildData.id);
    if (purged > 0) {
      console.log(`Purged ${purged} cached entries for guild ${event.guildData.id}`);
    }
  }
}
