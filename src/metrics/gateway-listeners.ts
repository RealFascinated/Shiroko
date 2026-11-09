import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import GuildJoinedEvent from "../event/events/guild-joined.event";
import GuildLeftEvent from "../event/events/guild-left.event";
import ShardDisconnectedEvent from "../event/events/shard-disconnected.event";
import ShardReconnectingEvent from "../event/events/shard-reconnecting.event";
import ShardResumedEvent from "../event/events/shard-resumed.event";
import { GatewayDisconnectsMetric, GatewayLifecycleMetric, GuildChurnMetric } from "./impl/gateway";
import type { Metric } from "./metric";

export class GatewayListeners extends EventListener {
  public readonly lifecycle: GatewayLifecycleMetric = new GatewayLifecycleMetric();
  public readonly disconnects: GatewayDisconnectsMetric = new GatewayDisconnectsMetric();
  public readonly guildChurn: GuildChurnMetric = new GuildChurnMetric();

  public constructor() {
    super();
    EventBus.subscribe(this);
  }

  public get metrics(): Metric<any>[] {
    return [this.lifecycle, this.disconnects, this.guildChurn];
  }

  @EventHandler(ShardDisconnectedEvent)
  public onShardDisconnected(event: ShardDisconnectedEvent): void {
    this.lifecycle.increment("disconnect");
    this.disconnects.increment(String(event.code));
  }

  @EventHandler(ShardReconnectingEvent)
  public onShardReconnecting(): void {
    this.lifecycle.increment("reconnecting");
  }

  @EventHandler(ShardResumedEvent)
  public onShardResumed(): void {
    this.lifecycle.increment("resume");
  }

  @EventHandler(GuildJoinedEvent)
  public onGuildJoined(): void {
    this.guildChurn.increment("joined");
  }

  @EventHandler(GuildLeftEvent)
  public onGuildLeft(): void {
    this.guildChurn.increment("left");
  }
}
