import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import ComponentReceivedEvent from "../event/events/component-received.event";
import ContextMenuReceivedEvent from "../event/events/context-menu-received.event";
import MemberGuildJoinEvent from "../event/events/member-guild-join.event";
import MessageCreatedEvent from "../event/events/message-created.event";
import SlashCommandReceivedEvent from "../event/events/slash-command-received.event";
import type { DiscordEventsMetric } from "./impl/discord-events";

/**
 * Increments the event-volume map from the bus. The bridge already funnels
 * every raw gateway event onto the bus, so this listener is the single
 * hook; the bridge never needs to know about metrics. Only high-volume
 * events are counted (load trends); rare admin events are excluded.
 */
export class EventVolumeListeners extends EventListener {
  public constructor(private readonly events: DiscordEventsMetric) {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(MessageCreatedEvent)
  public onMessageCreated(): void {
    this.events.increment("messages");
  }

  @EventHandler(MemberGuildJoinEvent)
  public onMemberGuildJoin(): void {
    this.events.increment("member_joins");
  }

  @EventHandler(SlashCommandReceivedEvent)
  public onSlashCommandReceived(): void {
    this.events.increment("slash_commands");
  }

  @EventHandler(ContextMenuReceivedEvent)
  public onContextMenuReceived(): void {
    this.events.increment("context_menus");
  }

  @EventHandler(ComponentReceivedEvent)
  public onComponentReceived(): void {
    this.events.increment("components");
  }
}
