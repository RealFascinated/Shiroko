import { yesNo } from "@/lib/format";
import type { GuildEmoji } from "discord.js";
import { changeLine, mentionList } from "./text";

export function describeEmojiChanges(oldEmoji: GuildEmoji, newEmoji: GuildEmoji): string[] {
  const lines: string[] = [];
  if (oldEmoji.name !== newEmoji.name) {
    lines.push(changeLine("Name", oldEmoji.name ?? "None", newEmoji.name ?? "None"));
  }
  if (oldEmoji.animated !== newEmoji.animated) {
    lines.push(changeLine("Animated", yesNo(oldEmoji.animated), yesNo(newEmoji.animated)));
  }
  const oldRoles = mentionList([...oldEmoji.roles.cache.keys()], "@&");
  const newRoles = mentionList([...newEmoji.roles.cache.keys()], "@&");
  if (oldRoles !== newRoles) {
    lines.push(changeLine("Role Restriction", oldRoles, newRoles));
  }
  return lines;
}
