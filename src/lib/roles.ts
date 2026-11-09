import type { Role } from "discord.js";

export function outranksBot(role: Role): boolean {
  const me = role.guild.members.me;
  return me !== null && role.position >= me.roles.highest.position;
}

/**
 * Whether a role can be assigned in its guild: it is not `@everyone` and
 * is not at or above the bot's highest role.
 */
export function isAssignableRole(role: Role): boolean {
  return role.id !== role.guild.id && !outranksBot(role);
}

/**
 * Why a role cannot be assigned, or `null` when it can. `purpose`
 * completes "`@everyone` cannot be ...", e.g. "an autorole".
 */
export function unassignableReason(role: Role, purpose: string): string | null {
  if (role.id === role.guild.id) {
    return `\`@everyone\` cannot be ${purpose}.`;
  }
  if (outranksBot(role)) {
    return `${role.name} is above my highest role, so I cannot assign it. Move it below my highest role and try again.`;
  }
  return null;
}
