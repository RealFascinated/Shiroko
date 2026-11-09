import UserDisplayNameUpdatedEvent from "@/event/events/user-display-name-updated.event";
import type { HistoryChange } from "@/history/history-kind";
import UserHistoryKind from "@/history/user-history-kind";

export default class DisplayNameKind extends UserHistoryKind<UserDisplayNameUpdatedEvent> {
  public readonly id: string = "display_name";
  public readonly label: string = "Display name";
  public readonly eventClass: new (...args: any[]) => UserDisplayNameUpdatedEvent =
    UserDisplayNameUpdatedEvent;

  protected change(event: UserDisplayNameUpdatedEvent): HistoryChange {
    return { oldValue: event.oldUser.globalName ?? null, newValue: event.newUser.globalName ?? null };
  }
}
