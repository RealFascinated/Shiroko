import type { Guild, PartialUser, User } from "discord.js";
import Event from "../event";

/**
 * A user's username changed, scoped to one mutual guild so per-guild
 * logging settings apply. Fired from `userUpdate`; usernames are global,
 * so this never comes from a `guildMemberUpdate`.
 */
export default class UserUsernameUpdatedEvent extends Event {
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
