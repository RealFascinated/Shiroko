import { AuditLogEvent, type GuildMember } from "discord.js";
import { channelMention } from "./text";

/**
 * How a departure reads, keyed by the audit action behind it. A member who
 * simply left has no entry, and a ban is logged separately, so the fallback
 * covers both.
 */
export const LEAVE_VERBS: Partial<Record<AuditLogEvent, string>> = {
  [AuditLogEvent.MemberKick]: "was kicked.",
  [AuditLogEvent.MemberPrune]: "was pruned for inactivity.",
};

/**
 * One line for a voice transition: a join, a leave, or a move between
 * channels. Returns `null` for a change that stayed in the same channel
 * (mute, deafen, streaming), which is not worth logging.
 */
export function describeVoiceChange(
  member: GuildMember,
  oldChannelId: string | null,
  newChannelId: string | null
): string | null {
  if (!oldChannelId && newChannelId) {
    return `${member} joined voice channel ${channelMention(newChannelId)}.`;
  }
  if (oldChannelId && !newChannelId) {
    return `${member} left voice channel ${channelMention(oldChannelId)}.`;
  }
  if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
    return `${member} moved voice channel ${channelMention(oldChannelId)} → ${channelMention(newChannelId)}.`;
  }
  return null;
}
