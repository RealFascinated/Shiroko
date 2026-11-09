import UserAvatarUpdatedEvent from "../../event/events/user-avatar-updated.event";
import UserBannerUpdatedEvent from "../../event/events/user-banner-updated.event";
import UserDisplayNameUpdatedEvent from "../../event/events/user-display-name-updated.event";
import UserUsernameUpdatedEvent from "../../event/events/user-username-updated.event";
import { UserHistoryKind, type HistoryChange } from "../history-kind";

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

export class AvatarKind extends UserHistoryKind<UserAvatarUpdatedEvent> {
  public readonly id: string = "avatar";
  public readonly label: string = "Avatar";
  public readonly eventClass: new (...args: any[]) => UserAvatarUpdatedEvent = UserAvatarUpdatedEvent;

  protected change(event: UserAvatarUpdatedEvent): HistoryChange {
    return { oldValue: event.beforeAssetUrl, newValue: event.afterAssetUrl };
  }
}

export class BannerKind extends UserHistoryKind<UserBannerUpdatedEvent> {
  public readonly id: string = "banner";
  public readonly label: string = "Banner";
  public readonly eventClass: new (...args: any[]) => UserBannerUpdatedEvent = UserBannerUpdatedEvent;

  protected change(event: UserBannerUpdatedEvent): HistoryChange {
    return { oldValue: event.beforeAssetUrl, newValue: event.afterAssetUrl };
  }
}
