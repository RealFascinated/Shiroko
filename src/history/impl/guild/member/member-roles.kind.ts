import { AuditLogEvent, type Role } from "discord.js";
import MemberRolesUpdatedEvent from "@/event/events/member-roles-updated.event";
import type { HistoryEntry } from "@/history/history-kind";
import GuildEventKind from "@/history/guild-event-kind";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";

/** Old/new hold the role ids that were added and removed; the roles a member ended up with are the replay of these. */
export default class MemberRolesKind extends GuildEventKind<MemberRolesUpdatedEvent> {
  public readonly id: string = "roles";
  public readonly label: string = "Roles";
  public readonly eventClass: new (...args: any[]) => MemberRolesUpdatedEvent = MemberRolesUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberRoleUpdate];

  public draft({ newMember, added, removed }: MemberRolesUpdatedEvent): GuildHistoryDraft {
    return {
      guild: newMember.guild,
      subjectId: newMember.id,
      oldValue: null,
      newValue: { added: [...added.keys()], removed: [...removed.keys()] },
    };
  }

  protected override title(row: HistoryEntry): string {
    const { added = [], removed = [] } = (row.newValue ?? {}) as { added?: string[]; removed?: string[] };
    if (added.length > 0 && removed.length > 0) {
      return "Roles changed";
    }
    const ids = added.length > 0 ? added : removed;
    return `${ids.length === 1 ? "Role" : "Roles"} ${added.length > 0 ? "added" : "removed"}`;
  }

  protected override details(row: HistoryEntry): string[] {
    const { added = [], removed = [] } = (row.newValue ?? {}) as { added?: string[]; removed?: string[] };
    const roles = (ids: string[]): string => ids.map(id => `<@&${id}>`).join(" ");
    if (added.length > 0 && removed.length > 0) {
      return [`**Added**: ${roles(added)}`, `**Removed**: ${roles(removed)}`];
    }
    const ids = added.length > 0 ? added : removed;
    return ids.length > 0 ? [`**${ids.length === 1 ? "Role" : "Roles"}**: ${roles(ids)}`] : [];
  }
}
