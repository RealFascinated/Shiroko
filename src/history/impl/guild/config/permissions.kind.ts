import type { JsonValue } from "@/db/schemas/guild-settings";
import Permissions, { flagLabels, PermissionFlags } from "@/permission/permissions";
import type { HistoryEntry } from "@/history/history-kind";
import GuildHistoryKind from "@/history/guild-history-kind";
import type { HistoryActor } from "@/history/history-writer";

interface RoleState {
  flags: string;
  parentRoleId: string | null;
}

/** Entries for `permission_roles` rows; the key is the role id. */
export default class PermissionsKind extends GuildHistoryKind {
  public readonly id: string = "permissions";
  public readonly label: string = "Permissions changed";
  public override readonly revertFlags: bigint = PermissionFlags.PERMISSIONS_COMMAND;

  protected override mention(subjectId: string): string {
    return `<@&${subjectId}>`;
  }

  protected override details(row: HistoryEntry): string[] {
    return [`${formatState(row.oldValue)} → ${formatState(row.newValue)}`];
  }

  public override async revert(row: HistoryEntry, actor: HistoryActor): Promise<void> {
    const previous = row.oldValue as RoleState | null;
    if (previous === null) {
      await Permissions.clearRole(actor.guild, row.subjectId, actor);
      return;
    }
    await Permissions.setRole(
      actor.guild,
      row.subjectId,
      BigInt(previous.flags),
      previous.parentRoleId,
      actor
    );
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
