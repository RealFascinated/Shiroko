import type { Guild, PartialUser, User } from "discord.js";
import Event from "../event";

/**
 * A user's global avatar changed, scoped to one mutual guild so per-guild
 * logging settings apply. Fired from `userUpdate`; a guild avatar change
 * is a separate `guildMemberUpdate` and does not reach this event.
 *
 * The stored URLs come from the caller (see `EventBridge`), which captures
 * the change before posting, so every listener gets a link that is known
 * to exist or null when the asset was not stored.
 */
export default class UserAvatarUpdatedEvent extends Event {
  public readonly guildData: Guild;
  public readonly oldUser: User | PartialUser;
  public readonly newUser: User | PartialUser;
  /** Stored URL of the previous avatar, or null when it was not stored. */
  public readonly beforeAssetUrl: string | null;
  /** Stored URL of the new avatar, or null when it was not stored. */
  public readonly afterAssetUrl: string | null;

  constructor(
    guild: Guild,
    oldUser: User | PartialUser,
    newUser: User | PartialUser,
    beforeAssetUrl: string | null,
    afterAssetUrl: string | null
  ) {
    super({ guild, userId: newUser.id });
    this.guildData = guild;
    this.oldUser = oldUser;
    this.newUser = newUser;
    this.beforeAssetUrl = beforeAssetUrl;
    this.afterAssetUrl = afterAssetUrl;
  }
}
