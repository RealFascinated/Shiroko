import { AuditLogEvent } from "discord.js";
import MemberUnbannedEvent from "@/event/events/member-unbanned.event";
import GuildEventKind from "@/history/guild-event-kind";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";

export default class MemberUnbanKind extends GuildEventKind<MemberUnbannedEvent> {
  public readonly id: string = "member_unban";
  public readonly label: string = "Unbanned";
  public readonly eventClass: new (...args: any[]) => MemberUnbannedEvent = MemberUnbannedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberBanRemove];

  public draft({ ban }: MemberUnbannedEvent): GuildHistoryDraft {
    return {
      guild: ban.guild,
      subjectId: ban.user.id,
      oldValue: { reason: ban.reason ?? null },
      newValue: null,
    };
  }
}
