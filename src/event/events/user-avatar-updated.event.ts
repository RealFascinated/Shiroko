import type { Guild, PartialUser, User } from "discord.js";
import Event from "../event";

/**
 * A user's global avatar changed, scoped to one mutual guild so per-guild
 * logging settings apply. Fired from `userUpdate`; a guild avatar change
 * is a separate `guildMemberUpdate` and does not reach this event.
 */
export default class UserAvatarUpdatedEvent extends Event {
  public readonly guildData: Guild;
  public readonly oldUser: User | PartialUser;
  public readonly newUser: User | PartialUser;

  constructor(guild: Guild, oldUser: User | PartialUser, newUser: User | PartialUser) {
    super({ guild, userId: newUser.id });
    this.guildData = guild;
    this.oldUser = oldUser;
    this.newUser = newUser;
  }
}
