import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import { formatValue, type AuditEntry } from "@/audit/audit-kind";
import GuildEventKind from "@/audit/guild-event-kind";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";

export default class MemberJoinKind extends GuildEventKind<MemberGuildJoinEvent> {
  public readonly id: string = "member_join";
  public readonly label: string = "Joined";
  public readonly eventClass: new (...args: any[]) => MemberGuildJoinEvent = MemberGuildJoinEvent;

  public draft({ member, source }: MemberGuildJoinEvent): GuildAuditDraft {
    return { guild: member.guild, subjectId: member.id, oldValue: null, newValue: source };
  }

  protected override details(row: AuditEntry): string[] {
    return [`**Via**: ${formatValue(row.newValue)}`];
  }
}
