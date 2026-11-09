import type { Guild, Message } from "discord.js";
import Event from "../event";

/**
 * A tracked member's message was recorded. Emitted by the stats listener
 * after a successful insert, carrying the message for progression hooks.
 */
export default class MessageRecordedEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly message: Message;

  constructor(options: { userId: string; guild: Guild; message: Message }) {
    super({
      guild: options.guild,
      userId: options.userId,
    });
    this.userId = options.userId;
    this.guildData = options.guild;
    this.message = options.message;
  }
}
