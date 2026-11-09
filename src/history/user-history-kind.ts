import type { PartialUser, User } from "discord.js";
import type Event from "@/event/event";
import { changeLine } from "./fields";
import HistoryKind, { type HistoryChange, type HistoryEntry } from "./history-kind";

export interface UserChangeEvent extends Event {
  oldUser: User | PartialUser;
  newUser: User | PartialUser;
}

export interface UserHistoryDraft extends HistoryChange {
  user: User;
}

/**
 * A change to a user's global account (username, avatar, ...), recorded once
 * per user in `user_history` from the gateway event that reports it.
 */
export default abstract class UserHistoryKind<E extends UserChangeEvent> extends HistoryKind {
  public abstract readonly eventClass: new (...args: any[]) => E;

  // The bridge posts one event per mutual guild for the same change, all
  // sharing one `oldUser`, so the repeats are the ones already seen. Keyed on
  // `oldUser` because discord.js mutates and re-emits the same cached
  // `newUser` object on every update.
  private readonly seen: WeakSet<object> = new WeakSet();

  protected abstract change(event: E): HistoryChange;

  public draft(event: E): UserHistoryDraft | null {
    if (event.newUser.partial || this.seen.has(event.oldUser)) {
      return null;
    }
    this.seen.add(event.oldUser);
    return { user: event.newUser, ...this.change(event) };
  }

  protected override title(row: HistoryEntry): string {
    return `${this.label} changed`;
  }

  protected override details(row: HistoryEntry): string[] | Promise<string[]> {
    return [changeLine(row.oldValue, row.newValue)];
  }
}
