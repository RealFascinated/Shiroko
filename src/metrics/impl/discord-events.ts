import { Metric } from "../metric";

/** Event kinds counted by {@link DiscordEventsMetric}: the high-volume raw Discord gateway events. */
export type DiscordEventName =
  "messages" | "member_joins" | "presence_changes" | "slash_commands" | "context_menus" | "components";

/**
 * Discord event volume as one map metric. Each key becomes its own time
 * series with the `event` label, so the exporter emits one line per key
 * (`discord_events_total{event="messages",job="arona"} 123`). Values are
 * cumulative since boot; per-second rates are computed downstream with
 * PromQL `rate(discord_events_total{event="..."}[5m])`, never here.
 */
export class DiscordEventsMetric extends Metric<Record<string, number>> {
  // Nothing to self-collect: the map is whatever events have made it so
  // far when the exporter snapshots it. The interval only exists to
  // satisfy the manager's uniform collect loop.
  public override readonly collectIntervalMs = 60_000;
  private readonly counts = new Map<DiscordEventName, number>();

  public constructor() {
    super({
      id: "discord_events_total",
      kind: "counter_map",
      help: "Discord events received since boot",
    });
  }

  public increment(event: DiscordEventName, by = 1): void {
    this.counts.set(event, (this.counts.get(event) ?? 0) + by);
  }

  public value(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}
