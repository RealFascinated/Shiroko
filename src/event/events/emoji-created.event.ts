import type { GuildEmoji } from "discord.js";
import Event from "../event";

export default class EmojiCreatedEvent extends Event {
  public readonly emojiId: string;
  public readonly emoji: GuildEmoji;
  public readonly guildData: GuildEmoji["guild"];

  constructor(emoji: GuildEmoji) {
    super({ guild: emoji.guild });
    this.emojiId = emoji.id;
    this.emoji = emoji;
    this.guildData = emoji.guild;
  }
}
