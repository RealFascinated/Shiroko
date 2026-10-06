import type { Guild, GuildScheduledEvent, PartialGuildScheduledEvent } from "discord.js";
import Event from "../event";

/** A guild scheduled event was deleted or canceled. */
export default class ScheduledEventDeletedEvent extends Event {
  public readonly scheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent;

  constructor(scheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent, guild: Guild) {
    super({ guild });
    this.scheduledEvent = scheduledEvent;
  }
}
