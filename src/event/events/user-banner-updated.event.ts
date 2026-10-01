import { MediaKind, mediaUrl } from "@/storage/media-key";
import type { Guild, PartialUser, User } from "discord.js";
import Event from "../event";

/**
 * A user's global banner changed, scoped to one mutual guild so per-guild
 * logging settings apply. Fired from `userUpdate`; a guild banner change is
 * a separate `guildMemberUpdate` and does not reach this event.
 *
 * The stored URLs are computed from the hashes, so consumers never build a
 * Discord CDN link or know the storage key layout.
 */
export default class UserBannerUpdatedEvent extends Event {
  public readonly guildData: Guild;
  public readonly oldUser: User | PartialUser;
  public readonly newUser: User | PartialUser;
  /** Public URL of the stored previous banner, or null when none was stored. */
  public readonly oldAssetUrl: string | null;
  /** Public URL of the stored new banner, or null when the banner was removed. */
  public readonly newAssetUrl: string | null;

  constructor(guild: Guild, oldUser: User | PartialUser, newUser: User | PartialUser) {
    super({ guild, userId: newUser.id });
    this.guildData = guild;
    this.oldUser = oldUser;
    this.newUser = newUser;
    this.oldAssetUrl = oldUser.banner ? mediaUrl(MediaKind.Banner, newUser.id, oldUser.banner) : null;
    this.newAssetUrl = newUser.banner ? mediaUrl(MediaKind.Banner, newUser.id, newUser.banner) : null;
  }
}
