import { CounterMapMetric } from "../counter-map";

/**
 * Gateway connection churn by `event`: `disconnect`, `reconnecting` and
 * `resume`. Occasional resumes are normal (Discord rotates sessions); a
 * steady stream of disconnects, or reconnects without matching resumes,
 * means the bot keeps losing its session and replaying startup.
 */
export class GatewayLifecycleMetric extends CounterMapMetric {
  public constructor() {
    super({
      id: "discord_gateway_lifecycle_total",
      label: "event",
      help: "Gateway shard lifecycle events since boot",
    });
  }
}

/**
 * Disconnects by WebSocket close code. Codes in the 4000 range are
 * Discord's: 4004 is a bad token and 4014 disallowed intents, both fatal.
 */
export class GatewayDisconnectsMetric extends CounterMapMetric {
  public constructor() {
    super({
      id: "discord_gateway_disconnects_total",
      label: "code",
      help: "Gateway disconnects by close code",
    });
  }
}

/**
 * Guilds the bot was added to or removed from since boot, by `change`.
 * Only post-ready joins count: the guilds delivered at startup are not
 * `GuildCreate` events.
 */
export class GuildChurnMetric extends CounterMapMetric {
  public constructor() {
    super({ id: "guild_changes_total", label: "change", help: "Guilds joined or left since boot" });
  }
}
