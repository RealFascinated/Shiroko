import { AuditLogEvent } from "discord.js";
import MemberGuildLeaveEvent from "@/event/events/member-guild-leave.event";
import type { HistoryEntry } from "@/history/history-kind";
import GuildEventKind from "@/history/guild-event-kind";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";

/**
 * The old value is the roles held at the moment of leaving, which is what a
 * sticky-role restore reads back; `null` when the member was not cached.
 */
export default class MemberLeaveKind extends GuildEventKind<MemberGuildLeaveEvent> {
  public readonly id: string = "member_leave";
  public readonly label: string = "Left";
  public readonly eventClass: new (...args: any[]) => MemberGuildLeaveEvent = MemberGuildLeaveEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberKick];

  public draft({ member }: MemberGuildLeaveEvent): GuildHistoryDraft {
    return {
      guild: member.guild,
      subjectId: member.id,
      oldValue: member.partial ? null : { roleIds: [...member.roles.cache.keys()] },
      newValue: null,
    };
  }

  protected override title(row: HistoryEntry): string {
    return row.actorId ? "Kicked" : this.label;
  }

  protected override details(row: HistoryEntry): string[] {
    const { roleIds = [] } = (row.oldValue ?? {}) as { roleIds?: string[] };
    return roleIds.length > 0 ? [`**Roles**: ${roleIds.map(id => `<@&${id}>`).join(" ")}`] : [];
  }
}
