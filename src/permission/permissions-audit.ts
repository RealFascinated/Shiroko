import AuditKind from "../audit/audit-kind";
import type { AuditActor } from "../audit/audit-log";
import type { GuildAuditLogSchema } from "../db/schemas/guild-audit-log";
import type { JsonValue } from "../db/schemas/guild-settings";
import Permissions, { flagLabels, PermissionFlags } from "./permissions";

interface RoleState {
  flags: string;
  parentRoleId: string | null;
}

/** Entries for `permission_roles` rows; the key is the role id. */
export default class PermissionsAuditKind extends AuditKind {
  public readonly id: string = "permissions";
  public readonly revertFlags: bigint = PermissionFlags.PERMISSIONS_COMMAND;

  public describe(entry: GuildAuditLogSchema): string {
    return `<@&${entry.key}>: ${formatState(entry.oldValue)} → ${formatState(entry.newValue)}`;
  }

  public async revert(entry: GuildAuditLogSchema, actor: AuditActor): Promise<void> {
    const previous = entry.oldValue as RoleState | null;
    if (previous === null) {
      await Permissions.clearRole(actor.guild, entry.key, actor);
      return;
    }
    await Permissions.setRole(actor.guild, entry.key, BigInt(previous.flags), previous.parentRoleId, actor);
  }
}

function formatState(value: JsonValue | null): string {
  if (value === null) {
    return "*none*";
  }
  const { flags, parentRoleId } = value as unknown as RoleState;
  const labels = flagLabels(BigInt(flags)).join(", ") || "no permissions";
  return parentRoleId ? `${labels} (inherits <@&${parentRoleId}>)` : labels;
}
