import type { Presence } from "discord.js";
import Event from "../event";

/**
 * A guild member's presence changed: status (online/idle/dnd/offline),
 * custom status, or activity. Wraps the old/new presences; `oldPresence`
 * is `null` when the previous state wasn't cached.
 */
export default class UserPresenceChangedEvent extends Event {
  public readonly oldPresence: Presence | null;
  public readonly newPresence: Presence;

  constructor(oldPresence: Presence | null, newPresence: Presence) {
    super({
      guild: newPresence.guild,
      userId: newPresence.userId,
    });
    this.oldPresence = oldPresence;
    this.newPresence = newPresence;
  }
}
