import { AuditLogEvent, type Role } from "discord.js";
import RoleUpdatedEvent from "@/event/events/role-updated.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { updated } from "../drafts";
import { roleFields } from "./role-fields";
import RoleKind from "./role-kind";

export default class RoleUpdateKind extends RoleKind<RoleUpdatedEvent> {
  public readonly id: string = "role_update";
  public readonly label: string = "Role updated";
  public readonly eventClass: new (...args: any[]) => RoleUpdatedEvent = RoleUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.RoleUpdate];

  public draft(event: RoleUpdatedEvent): GuildHistoryDraft | null {
    return updated(event.guildData, event.roleId, roleFields(event.oldRole), roleFields(event.newRole));
  }
}
