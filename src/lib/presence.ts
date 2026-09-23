import { ActivityType, type Client } from "discord.js";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import BotReadyEvent from "../event/events/bot-ready.event";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Keeps the bot's presence showing how many guilds it is in: set once on
 * ready, then re-pushed on a timer. Polling instead of reacting to
 * joins/leaves also recovers the presence after Discord drops or resets
 * it, and after a reconnect.
 */
export class PresenceListener extends EventListener {
  private timer: Timer | undefined;

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    const client = event.client;
    updatePresence(client);
    clearInterval(this.timer);
    this.timer = setInterval(() => updatePresence(client), REFRESH_INTERVAL_MS);
  }
}

/**
 * Point the bot's presence at the guild count. `setActivity` only sets
 * the activity, leaving the status (online/idle) alone.
 */
function updatePresence(client: Client): void {
  client.user?.setActivity({
    name: `${client.guilds.cache.size.toLocaleString("en-US")} servers`,
    type: ActivityType.Watching,
  });
}
