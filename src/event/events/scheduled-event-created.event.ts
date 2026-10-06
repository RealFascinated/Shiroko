import type { Guild, GuildScheduledEvent } from "discord.js";
import Event from "../event";

/**
 * A guild scheduled event was created. The guild is passed in because the
 * raw payload only carries its id.
 */
export default class ScheduledEventCreatedEvent extends Event {
  public readonly scheduledEvent: GuildScheduledEvent;

  constructor(scheduledEvent: GuildScheduledEvent, guild: Guild) {
    super({ guild });
    this.scheduledEvent = scheduledEvent;
  }
}
