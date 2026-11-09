import { AuditLogEvent } from "discord.js";
import MemberNicknameUpdatedEvent from "@/event/events/member-nickname-updated.event";
import { changeLine } from "@/history/fields";
import type { HistoryEntry } from "@/history/history-kind";
import GuildEventKind from "@/history/guild-event-kind";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";

export default class MemberNicknameKind extends GuildEventKind<MemberNicknameUpdatedEvent> {
  public readonly id: string = "nickname";
  public readonly label: string = "Nickname";
  public readonly eventClass: new (...args: any[]) => MemberNicknameUpdatedEvent = MemberNicknameUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberUpdate];

  public draft({ oldMember, newMember }: MemberNicknameUpdatedEvent): GuildHistoryDraft {
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

  protected override details(row: HistoryEntry): string[] {
    return [changeLine(row.oldValue, row.newValue)];
  }
}
