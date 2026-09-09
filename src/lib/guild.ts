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
 * `guildId`, `guild.id`, and `member.guild.id` on any arg. Returns
 * `undefined` when no guild is present (DMs, `ClientReady`).
 */
export function extractGuildFromArgs(...args: unknown[]): Guild | string | null | undefined {
  for (const arg of args) {
    if (!arg || typeof arg !== "object") {
      continue;
    }
    const candidate = arg as { guildId?: unknown; guild?: Guild; member?: { guild?: Guild } };
    if (typeof candidate.guildId === "string") {
      return candidate.guildId;
    }
    const guild = candidate.guild ?? candidate.member?.guild;
    if (typeof guild?.id === "string") {
      return guild;
    }
  }
  return undefined;
}
