import type { PartialUser, User } from "discord.js";
import type { JsonValue } from "@/db/schemas/guild-settings";
import type UserAvatarUpdatedEvent from "@/event/events/user-avatar-updated.event";
import type UserBannerUpdatedEvent from "@/event/events/user-banner-updated.event";
import type { AuditChange, AuditEntry } from "@/audit/audit-kind";
import UserAuditKind from "@/audit/user-audit-kind";
import { transition } from "@/audit/fields";
import { MediaKind } from "@/storage/media-key";
import MediaService from "@/storage/media.service";

/**
 * Avatar and banner values are `{ hash, url }` (null = none). The hash
 * outlives the stored file, whose `url` goes dead once the media sweep
 * deletes it, so describing a change looks the expiry up.
 */
export default abstract class AssetKind<
  E extends UserAvatarUpdatedEvent | UserBannerUpdatedEvent,
> extends UserAuditKind<E> {
  protected abstract readonly mediaKind: MediaKind;

  protected abstract hash(user: User | PartialUser): string | null;

  protected change(event: E): AuditChange {
    const asset = (hash: string | null, url: string | null): JsonValue | null =>
      hash ? { hash, url } : null;
    return {
      oldValue: asset(this.hash(event.oldUser), event.beforeAssetUrl),
      newValue: asset(this.hash(event.newUser), event.afterAssetUrl),
    };
  }

  protected override async details(row: AuditEntry): Promise<string[]> {
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
