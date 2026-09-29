import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import GuildLeftEvent from "../event/events/guild-left.event";
import { Caches } from "./index";

/**
 * Drops cached data for guilds the bot is no longer in. Lives in its own
 * file so `cache/index.ts` stays free of the event bus, which imports
 * `GuildFeatures`, which imports the cache registry.
 */
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
