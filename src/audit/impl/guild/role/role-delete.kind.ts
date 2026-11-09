import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent, type Role } from "discord.js";
import RoleDeletedEvent from "@/event/events/role-deleted.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { deleted } from "../drafts";
import { roleFields } from "./role-fields";
import RoleKind from "./role-kind";

export default class RoleDeleteKind extends RoleKind<RoleDeletedEvent> {
  public readonly id: string = "role_delete";
  public readonly label: string = "Role deleted";
  public readonly eventClass: EventClass<RoleDeletedEvent> = RoleDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.RoleDelete];

  public draft(event: RoleDeletedEvent): GuildAuditDraft | null {
    return deleted(event.guildData, event.roleId, roleFields(event.role));
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}
