import type { Guild, GuildScheduledEvent, PartialGuildScheduledEvent, User } from "discord.js";
import Event from "../event";

/** A user marked interest in a guild scheduled event. */
export default class ScheduledEventUserAddedEvent extends Event {
  public readonly scheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent;
  public readonly user: User;

  constructor(scheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent, user: User, guild: Guild) {
    super({ guild, userId: user.id });
    this.scheduledEvent = scheduledEvent;
    this.user = user;
  }
}
