import type { Guild, GuildMember } from "discord.js";

/**
 * Resolve a guild member, checking the cache first and fetching from the API
 * if necessary. Returns `null` if the member cannot be found.
 */
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
