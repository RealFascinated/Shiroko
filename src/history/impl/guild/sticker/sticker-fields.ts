import type { Sticker } from "discord.js";
import type { Fields } from "../drafts";

export function stickerFields(sticker: Sticker): Fields {
  return { name: sticker.name, description: sticker.description, tags: sticker.tags };
}
