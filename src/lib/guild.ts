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

/**
 * Best-effort guild lookup for common discord.js shapes. Covers
 * `guild` and `member.guild` on any arg. Returns
 * `undefined` when no guild is present (DMs, `ClientReady`).
 */
export function extractGuildFromArgs(...args: unknown[]): Guild | null | undefined {
  for (const arg of args) {
    if (!arg || typeof arg !== "object") {
      continue;
    }
    const candidate = arg as { guild?: Guild; member?: { guild?: Guild } };
    const guild = candidate.guild ?? candidate.member?.guild;
    if (typeof guild?.id === "string") {
      return guild;
    }
  }
  return undefined;
}
