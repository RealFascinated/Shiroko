import type { AnyThreadChannel } from "discord.js";
import Event from "../event";

/** A thread was deleted. */
export default class ThreadDeletedEvent extends Event {
  public readonly thread: AnyThreadChannel;

  constructor(thread: AnyThreadChannel) {
    super({
      guild: thread.guild,
      userId: thread.ownerId,
    });
    this.thread = thread;
  }
}
