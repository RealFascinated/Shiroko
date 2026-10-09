import { yesNo } from "@/lib/format";
import type { Role } from "discord.js";
import { changeLine, permissionLine } from "./text";

export function describeRoleChanges(oldRole: Role, newRole: Role): string[] {
  const lines: string[] = [];
  if (oldRole.name !== newRole.name) {
    lines.push(changeLine("Name", oldRole.name, newRole.name));
  }
  if (oldRole.hexColor !== newRole.hexColor) {
    lines.push(changeLine("Color", oldRole.hexColor, newRole.hexColor));
  }
  if (oldRole.hoist !== newRole.hoist) {
    lines.push(changeLine("Hoisted", yesNo(oldRole.hoist), yesNo(newRole.hoist)));
  }
  if (oldRole.mentionable !== newRole.mentionable) {
    lines.push(changeLine("Mentionable", yesNo(oldRole.mentionable), yesNo(newRole.mentionable)));
  }
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
    // `missing` returns the bit names present in its argument but absent
    // from the receiver, so the old field's missing bits are what the new
    // one gained, and vice versa. `checkAdmin: false` keeps Administrator
    // a normal bit so it can be reported like any other.
    const granted = oldRole.permissions.missing(newRole.permissions.bitfield, false);
    const revoked = newRole.permissions.missing(oldRole.permissions.bitfield, false);
    if (granted.length > 0 || revoked.length > 0) {
      lines.push(permissionLine("Permissions", granted, revoked));
    }
  }
  return lines;
}
