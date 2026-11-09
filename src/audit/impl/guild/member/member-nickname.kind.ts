import { AuditLogEvent } from "discord.js";
import MemberNicknameUpdatedEvent from "@/event/events/member-nickname-updated.event";
import { changeLine } from "@/audit/fields";
import type { AuditEntry, EventClass } from "@/audit/audit-kind";
import GuildEventKind from "@/audit/guild-event-kind";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";

export default class MemberNicknameKind extends GuildEventKind<MemberNicknameUpdatedEvent> {
  public readonly id: string = "nickname";
  public readonly label: string = "Nickname";
  public readonly eventClass: EventClass<MemberNicknameUpdatedEvent> = MemberNicknameUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberUpdate];

  public draft({ oldMember, newMember }: MemberNicknameUpdatedEvent): GuildAuditDraft {
    return {
      guild: newMember.guild,
      subjectId: newMember.id,
      oldValue: oldMember.nickname,
      newValue: newMember.nickname,
    };
  }

  protected override title(): string {
    return `${this.label} changed`;
  }

  protected override details(row: AuditEntry): string[] {
    return [changeLine(row.oldValue, row.newValue)];
  }
}
