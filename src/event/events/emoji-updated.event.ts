import type { GuildEmoji } from "discord.js";
import Event from "../event";

/**
 * A guild emoji was updated. Carries the emoji before and after so
 * consumers can diff the fields they care about.
 */
export default class EmojiUpdatedEvent extends Event {
  public readonly emojiId: string;
  public readonly guildData: GuildEmoji["guild"];
  public readonly oldEmoji: GuildEmoji;
  public readonly newEmoji: GuildEmoji;

  constructor(oldEmoji: GuildEmoji, newEmoji: GuildEmoji) {
    super({ guild: newEmoji.guild });
    this.emojiId = newEmoji.id;
    this.guildData = newEmoji.guild;
    this.oldEmoji = oldEmoji;
    this.newEmoji = newEmoji;
  }
}
