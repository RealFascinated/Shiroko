import type { Guild, GuildMember, Role } from "discord.js";

/**
 * Counts from a guild-wide role sync. `changed` counts members who
 * received at least one role; `granted` counts the roles handed out.
 */
export interface MemberSyncResult {
  scanned: number;
  changed: number;
  granted: number;
  failed: number;
}

/**
 * Progress callback: `scanned` of `total` members have been examined so far.
 */
export type MemberSyncProgress = (scanned: number, total: number) => Promise<void>;

/**
 * Grant each human member the roles `missingRoles` returns for them. Bots
 * are ignored, grant failures are logged and counted, never fatal, and
 * `onProgress` is awaited every 100 members and on the final member.
 */
export async function syncMembers(
  guild: Guild,
  reason: string,
  missingRoles: (member: GuildMember) => Role[],
  onProgress?: MemberSyncProgress
): Promise<MemberSyncResult> {
  const result: MemberSyncResult = { scanned: 0, changed: 0, granted: 0, failed: 0 };
  const members = await guild.members.fetch();
  const total = members.size;
  for (const member of members.values()) {
    result.scanned++;
    if (!member.user.bot) {
      const missing = missingRoles(member);
      if (missing.length > 0) {
        try {
          await member.roles.add(missing, reason);
          result.changed++;
          result.granted += missing.length;
        } catch (error) {
          result.failed++;
          console.error(`Failed to grant ${reason} roles to ${member.id} in ${guild.id}:`, error);
        }
      }
    }
    if (onProgress && (result.scanned % 100 === 0 || result.scanned === total)) {
      await onProgress(result.scanned, total);
    }
  }
  return result;
}
