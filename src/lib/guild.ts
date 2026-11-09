import type { Guild, GuildMember } from "discord.js";

export async function fetchGuildMember(guild: Guild, userId: string): Promise<GuildMember | null> {
  const member = guild.members.cache.get(userId) ?? null;
  if (member) {
    return member;
  }

  try {
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}
