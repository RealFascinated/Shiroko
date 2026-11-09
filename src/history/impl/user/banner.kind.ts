import type { PartialUser, User } from "discord.js";
import UserBannerUpdatedEvent from "@/event/events/user-banner-updated.event";
import AssetKind from "./asset-kind";
import { MediaKind } from "@/storage/media-key";

export default class BannerKind extends AssetKind<UserBannerUpdatedEvent> {
  public readonly id: string = "banner";
  public readonly label: string = "Banner";
  public readonly eventClass: new (...args: any[]) => UserBannerUpdatedEvent = UserBannerUpdatedEvent;
  protected readonly mediaKind: MediaKind = MediaKind.Banner;

  protected hash(user: User | PartialUser): string | null {
    return user.banner ?? null;
  }
}
