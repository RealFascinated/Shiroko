import type { Guild, GuildScheduledEvent, PartialGuildScheduledEvent } from "discord.js";
import Event from "../event";

/**
 * A guild scheduled event's details or status changed. `oldEvent` is
 * Discord's previous state, which is absent when the event was not cached
 * and partial when Discord sent it without its details, so consumers read
 * every field defensively.
 */
export default class ScheduledEventUpdatedEvent extends Event {
  public readonly oldEvent: GuildScheduledEvent | PartialGuildScheduledEvent | null;
  public readonly newEvent: GuildScheduledEvent | PartialGuildScheduledEvent;

  constructor(
    oldEvent: GuildScheduledEvent | PartialGuildScheduledEvent | null,
    newEvent: GuildScheduledEvent | PartialGuildScheduledEvent,
    guild: Guild
  ) {
    super({ guild });
    this.oldEvent = oldEvent;
    this.newEvent = newEvent;
  }
}
