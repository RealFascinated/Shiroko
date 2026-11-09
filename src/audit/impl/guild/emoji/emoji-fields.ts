import type { GuildEmoji } from "discord.js";
import type { Fields } from "../drafts";

export function emojiFields(emoji: GuildEmoji): Fields {
  return { name: emoji.name, animated: emoji.animated };
}
