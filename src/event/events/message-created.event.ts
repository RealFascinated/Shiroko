import type { Guild, Message } from "discord.js";
import type GlobalUser from "../../user/global-user";
import Event from "../event";

/**
 * A message was sent in a guild. Wraps the raw `Message` plus pre-resolved
 * context (guild, author's user id, global user) for stats recording.
 */
export default class MessageCreatedEvent extends Event {
  public readonly message: Message;

  constructor(message: Message, guild: Guild | null, globalUser: GlobalUser | null = null) {
    super({
      guild,
      userId: message.author.id,
      globalUser,
    });
    this.message = message;
  }
}
