import MemberBoostUpdatedEvent from "@/event/events/member-boost-updated.event";
import type { AuditEntry } from "@/audit/audit-kind";
import GuildEventKind from "@/audit/guild-event-kind";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";

export default class MemberBoostKind extends GuildEventKind<MemberBoostUpdatedEvent> {
  public readonly id: string = "boost";
  public readonly label: string = "Boost";
  public readonly eventClass: new (...args: any[]) => MemberBoostUpdatedEvent = MemberBoostUpdatedEvent;

  public draft({ newMember, boosted }: MemberBoostUpdatedEvent): GuildAuditDraft {
    return { guild: newMember.guild, subjectId: newMember.id, oldValue: !boosted, newValue: boosted };
  }

  protected override title(row: AuditEntry): string {
    return row.newValue ? "Started boosting" : "Stopped boosting";
  }

  protected override details(): string[] {
    return [];
  }
}
