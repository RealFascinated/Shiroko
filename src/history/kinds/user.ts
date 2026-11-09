import UserAvatarUpdatedEvent from "../../event/events/user-avatar-updated.event";
import UserBannerUpdatedEvent from "../../event/events/user-banner-updated.event";
import UserDisplayNameUpdatedEvent from "../../event/events/user-display-name-updated.event";
import UserUsernameUpdatedEvent from "../../event/events/user-username-updated.event";
import type { PartialUser, User } from "discord.js";
import type { JsonValue } from "../../db/schemas/guild-settings";
import MediaService from "../../storage/media.service";
import { MediaKind } from "../../storage/media-key";
import { transition } from "../fields";
import { UserHistoryKind, type HistoryChange, type HistoryEntry } from "../history-kind";

export class UsernameKind extends UserHistoryKind<UserUsernameUpdatedEvent> {
  public readonly id: string = "username";
  public readonly label: string = "Username";
  public readonly eventClass: new (...args: any[]) => UserUsernameUpdatedEvent = UserUsernameUpdatedEvent;

  protected change(event: UserUsernameUpdatedEvent): HistoryChange {
    return { oldValue: event.oldUser.username ?? null, newValue: event.newUser.username ?? null };
  }
}

export class DisplayNameKind extends UserHistoryKind<UserDisplayNameUpdatedEvent> {
  public readonly id: string = "display_name";
  public readonly label: string = "Display name";
  public readonly eventClass: new (...args: any[]) => UserDisplayNameUpdatedEvent =
    UserDisplayNameUpdatedEvent;

  protected change(event: UserDisplayNameUpdatedEvent): HistoryChange {
    return { oldValue: event.oldUser.globalName ?? null, newValue: event.newUser.globalName ?? null };
  }
}

/**
 * Avatar and banner values are `{ hash, url }` (null = none). The hash
 * outlives the stored file, whose `url` goes dead once the media sweep
 * deletes it, so describing a change looks the expiry up.
 */
abstract class AssetKind<
  E extends UserAvatarUpdatedEvent | UserBannerUpdatedEvent,
> extends UserHistoryKind<E> {
  protected abstract readonly mediaKind: MediaKind;

  protected abstract hash(user: User | PartialUser): string | null;

  protected change(event: E): HistoryChange {
    const asset = (hash: string | null, url: string | null): JsonValue | null =>
      hash ? { hash, url } : null;
    return {
      oldValue: asset(this.hash(event.oldUser), event.beforeAssetUrl),
      newValue: asset(this.hash(event.newUser), event.afterAssetUrl),
    };
  }

  protected override async details(row: HistoryEntry): Promise<string[]> {
    const [before, after] = await Promise.all([
      this.side(row.subjectId, row.oldValue),
      this.side(row.subjectId, row.newValue),
    ]);
    return [transition(before, after)];
  }

  private async side(userId: string, value: JsonValue | null): Promise<string | null> {
    if (value === null) {
      return null;
    }
    const { hash, url } = value as { hash: string; url: string | null };
    if (!url) {
      return `\`${hash}\` (not stored)`;
    }
    return (await MediaService.isExpired(this.mediaKind, userId, hash))
      ? `\`${hash}\` (expired)`
      : `[view](${url})`;
  }
}

export class AvatarKind extends AssetKind<UserAvatarUpdatedEvent> {
  public readonly id: string = "avatar";
  public readonly label: string = "Avatar";
  public readonly eventClass: new (...args: any[]) => UserAvatarUpdatedEvent = UserAvatarUpdatedEvent;
  protected readonly mediaKind: MediaKind = MediaKind.Avatar;

  protected hash(user: User | PartialUser): string | null {
    return user.avatar ?? null;
  }
}

export class BannerKind extends AssetKind<UserBannerUpdatedEvent> {
  public readonly id: string = "banner";
  public readonly label: string = "Banner";
  public readonly eventClass: new (...args: any[]) => UserBannerUpdatedEvent = UserBannerUpdatedEvent;
  protected readonly mediaKind: MediaKind = MediaKind.Banner;

  protected hash(user: User | PartialUser): string | null {
    return user.banner ?? null;
  }
}
