import { AuditLogEvent, type Role } from "discord.js";
import MemberRolesUpdatedEvent from "@/event/events/member-roles-updated.event";
import type { AuditEntry, EventClass } from "@/audit/audit-kind";
import GuildEventKind from "@/audit/guild-event-kind";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";

/** Old/new hold the role ids that were added and removed; the roles a member ended up with are the replay of these. */
export default class MemberRolesKind extends GuildEventKind<MemberRolesUpdatedEvent> {
  public readonly id: string = "roles";
  public readonly label: string = "Roles";
  public readonly eventClass: EventClass<MemberRolesUpdatedEvent> = MemberRolesUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberRoleUpdate];

  public draft({ newMember, added, removed }: MemberRolesUpdatedEvent): GuildAuditDraft {
    return {
      guild: newMember.guild,
      subjectId: newMember.id,
      oldValue: null,
      newValue: { added: [...added.keys()], removed: [...removed.keys()] },
    };
  }

  private changes(row: AuditEntry): { added: string[]; removed: string[] } {
    const { added = [], removed = [] } = (row.newValue ?? {}) as { added?: string[]; removed?: string[] };
    return { added, removed };
  }

  protected override title(row: AuditEntry): string {
    const { added, removed } = this.changes(row);
    if (added.length > 0 && removed.length > 0) {
      return "Roles changed";
    }
    const ids = added.length > 0 ? added : removed;
    return `${ids.length === 1 ? "Role" : "Roles"} ${added.length > 0 ? "added" : "removed"}`;
  }

  protected override details(row: AuditEntry): string[] {
    const { added, removed } = this.changes(row);
    const roles = (ids: string[]): string => ids.map(id => `<@&${id}>`).join(" ");
    if (added.length > 0 && removed.length > 0) {
      return [`**Added**: ${roles(added)}`, `**Removed**: ${roles(removed)}`];
    }
    const ids = added.length > 0 ? added : removed;
    return ids.length > 0 ? [`**${ids.length === 1 ? "Role" : "Roles"}**: ${roles(ids)}`] : [];
  }
}
