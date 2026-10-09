import { AuditLogEvent, type GuildMember } from "discord.js";
import type { JoinSource } from "@/feature/impl/invites/join-source";
import { channelMention, code, detailLine, userMention } from "./text";

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
 * The invite a join came from, as a detail line: the code and the member
 * whose invite it is, or the vanity URL. "Unknown" covers joins nothing
 * accounted for, such as the OAuth widget or a guild the bot cannot track.
 */
export function joinSourceLines(source: JoinSource | null): string[] {
  if (!source) {
    return [detailLine("Invite", "Unknown")];
  }
  if (source.kind === "vanity") {
    return [detailLine("Vanity URL", code(source.code))];
  }
  const inviter = source.inviterId ? ` by ${userMention(source.inviterId)}` : "";
  return [detailLine("Invite", `${code(source.code)}${inviter}`)];
}

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
