import type { Role } from "discord.js";
import type { Fields } from "../drafts";

export function roleFields(role: Role): Fields {
  return {
    name: role.name,
    color: role.hexColor,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield.toString(),
  };
}
