import type { PartialUser, User } from "discord.js";
import type { JsonValue } from "@/db/schemas/guild-settings";
import type UserAvatarUpdatedEvent from "@/event/events/user-avatar-updated.event";
import type UserBannerUpdatedEvent from "@/event/events/user-banner-updated.event";
import type { AuditChange, AuditEntry } from "@/audit/audit-kind";
import UserAuditKind from "@/audit/user-audit-kind";
import { transition } from "@/audit/fields";
import { MediaKind, mediaUrl } from "@/storage/media-key";
import MediaService from "@/storage/media.service";

/**
 * Avatar and banner values are the asset hash (null = none). The hash
 * outlives the stored file, so the link is built from it when an entry is
 * described, and only while the media table says the file still exists.
 */
export default abstract class AssetKind<
  E extends UserAvatarUpdatedEvent | UserBannerUpdatedEvent,
> extends UserAuditKind<E> {
  protected abstract readonly mediaKind: MediaKind;

  protected abstract hash(user: User | PartialUser): string | null;

  protected change(event: E): AuditChange {
    return { oldValue: this.hash(event.oldUser), newValue: this.hash(event.newUser) };
  }

  protected override async details(row: AuditEntry): Promise<string[]> {
    const [before, after] = await Promise.all([
      this.side(row.subjectId, row.oldValue),
      this.side(row.subjectId, row.newValue),
    ]);
    return [transition(before, after)];
  }

  private async side(userId: string, hash: JsonValue | null): Promise<string | null> {
    if (hash === null) {
      return null;
    }
    return (await MediaService.isExpired(this.mediaKind, userId, String(hash)))
      ? "*expired*"
      : `[view](${mediaUrl(this.mediaKind, userId, String(hash))})`;
  }
}
