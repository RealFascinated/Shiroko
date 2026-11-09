import { AuditLogEvent } from "discord.js";
import MemberBannedEvent from "@/event/events/member-banned.event";
import GuildEventKind from "@/audit/guild-event-kind";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";

export default class MemberBanKind extends GuildEventKind<MemberBannedEvent> {
  public readonly id: string = "member_ban";
  public readonly label: string = "Banned";
  public readonly eventClass: new (...args: any[]) => MemberBannedEvent = MemberBannedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberBanAdd];

  public draft({ ban }: MemberBannedEvent): GuildAuditDraft {
    return {
      guild: ban.guild,
      subjectId: ban.user.id,
      oldValue: null,
      newValue: { reason: ban.reason ?? null },
    };
  }
}
