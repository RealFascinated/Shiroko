import type { AnyThreadChannel } from "discord.js";
import Event from "../event";

/**
 * A thread was created. The bridge only posts this when Discord flags the
 * thread as newly created, since `ThreadCreate` also fires when the bot
 * merely gains access to an existing thread.
 */
export default class ThreadCreatedEvent extends Event {
  public readonly thread: AnyThreadChannel;

  constructor(thread: AnyThreadChannel) {
    super({
      guild: thread.guild,
      userId: thread.ownerId,
    });
    this.thread = thread;
  }
}
