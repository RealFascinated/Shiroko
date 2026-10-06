import type { AnyThreadChannel } from "discord.js";
import Event from "../event";

/**
 * A thread's own settings changed (name, archived/locked state, slow mode,
 * auto-archive duration, applied tags).
 */
export default class ThreadUpdatedEvent extends Event {
  public readonly oldThread: AnyThreadChannel;
  public readonly newThread: AnyThreadChannel;

  constructor(oldThread: AnyThreadChannel, newThread: AnyThreadChannel) {
    super({
      guild: newThread.guild,
      userId: newThread.ownerId,
    });
    this.oldThread = oldThread;
    this.newThread = newThread;
  }
}
