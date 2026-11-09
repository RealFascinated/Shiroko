import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent, type Role } from "discord.js";
import RoleCreatedEvent from "@/event/events/role-created.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { created } from "../drafts";
import { roleFields } from "./role-fields";
import RoleKind from "./role-kind";

export default class RoleCreateKind extends RoleKind<RoleCreatedEvent> {
  public readonly id: string = "role_create";
  public readonly label: string = "Role created";
  public readonly eventClass: EventClass<RoleCreatedEvent> = RoleCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.RoleCreate];

  public draft(event: RoleCreatedEvent): GuildAuditDraft | null {
    return created(event.guildData, event.roleId, roleFields(event.role));
  }
}
