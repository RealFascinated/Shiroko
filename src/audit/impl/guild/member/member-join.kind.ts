import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import type { AuditEntry, EventClass } from "@/audit/audit-kind";
import { code } from "@/audit/fields";
import GuildEventKind from "@/audit/guild-event-kind";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import type { JoinSource } from "@/lib/join-source";

export default class MemberJoinKind extends GuildEventKind<MemberGuildJoinEvent> {
  public readonly id: string = "member_join";
  public readonly label: string = "Joined";
  public readonly eventClass: EventClass<MemberGuildJoinEvent> = MemberGuildJoinEvent;

  public draft({ member, source }: MemberGuildJoinEvent): GuildAuditDraft {
    return { guild: member.guild, subjectId: member.id, oldValue: null, newValue: source };
  }

  protected override details(row: AuditEntry): string[] {
    const source = row.newValue as JoinSource | null;
    if (!source) {
      return [];
    }
    if (source.kind === "vanity") {
      return [`**Vanity URL**: ${code(source.code)}`];
    }
    return [`**Invite**: ${code(source.code)}${source.inviterId ? ` by <@${source.inviterId}>` : ""}`];
  }
}
