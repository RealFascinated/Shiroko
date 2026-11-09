import { AuditLogEvent } from "discord.js";
import MemberUnbannedEvent from "@/event/events/member-unbanned.event";
import GuildEventKind from "@/audit/guild-event-kind";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";

export default class MemberUnbanKind extends GuildEventKind<MemberUnbannedEvent> {
  public readonly id: string = "member_unban";
  public readonly label: string = "Unbanned";
  public readonly eventClass: new (...args: any[]) => MemberUnbannedEvent = MemberUnbannedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberBanRemove];

  public draft({ ban }: MemberUnbannedEvent): GuildAuditDraft {
    return {
      guild: ban.guild,
      subjectId: ban.user.id,
      oldValue: { reason: ban.reason ?? null },
      newValue: null,
    };
  }
}
