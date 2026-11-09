import type { EventClass } from "@/audit/audit-kind";
import type { PartialUser, User } from "discord.js";
import UserAvatarUpdatedEvent from "@/event/events/user-avatar-updated.event";
import AssetKind from "./asset-kind";
import { MediaKind } from "@/storage/media-key";

export default class AvatarKind extends AssetKind<UserAvatarUpdatedEvent> {
  public readonly id: string = "avatar";
  public readonly label: string = "Avatar";
  public readonly eventClass: EventClass<UserAvatarUpdatedEvent> = UserAvatarUpdatedEvent;
  protected readonly mediaKind: MediaKind = MediaKind.Avatar;

  protected hash(user: User | PartialUser): string | null {
    return user.avatar ?? null;
  }
}
