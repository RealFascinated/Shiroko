import type { SystemChannelFlagsBitField } from "discord.js";
import { Constants } from "@/constants";

/** One value as inline code. */
export function code(value: string): string {
  return `\`${value}\``;
}

/** A labelled value line, e.g. `**➜** Type: \`Voice\``. */
export function detailLine(label: string, value: string): string {
  return `${Constants.bullet} ${label}: ${value}`;
}

/** A before/after pair on its own, e.g. `` `a` → `b` ``. */
export function changeDetail(before: string, after: string): string {
  return `${before} → ${after}`;
}

/** A labelled before/after line, e.g. `**➜** Name: \`a\` → \`b\``. */
export function changeLine(label: string, before: string, after: string): string {
  return detailLine(label, changeDetail(before, after));
}

/** A comma-separated list of values as inline code, or "None" when empty. */
export function codeList(values: readonly string[]): string {
  return values.length > 0 ? values.map(code).join(", ") : "None";
}

/** A comma-separated list of channel/role/user mentions, or "None" when empty. */
export function mentionList(ids: readonly string[], prefix: "#" | "@" | "@&"): string {
  return ids.length > 0 ? ids.map(id => `<${prefix}${id}>`).join(", ") : "None";
}

/** A channel id as a mention, or `fallback` when unset. */
export function channelMention(channelId: string | null | undefined, fallback = "None"): string {
  return channelId ? `<#${channelId}>` : fallback;
}

/** A user id as a mention, or `fallback` when unset. */
export function userMention(userId: string | null | undefined, fallback = "Unknown"): string {
  return userId ? `<@${userId}>` : fallback;
}

/** An entity's name in bold, or its id in code when the name is missing. */
export function boldNameOrId(name: string | null | undefined, id: string): string {
  return name ? `**${name}**` : code(id);
}

/** A map's user-facing name for `value`, falling back to the raw value. */
export function enumLabel(names: Record<number, string>, value: number, fallback?: string): string {
  return names[value] ?? fallback ?? String(value);
}

/** A Discord timestamp from a date or unix seconds, or "None" when unset. */
export function timestamp(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "None";
  }
  const seconds = value instanceof Date ? value.getTime() / 1000 : value / 1000;
  return `<t:${Math.floor(seconds)}:f>`;
}

/** Split the camelCase Discord uses in a permission name: `ManageGuild` -> `Manage Guild`. */
export function permissionLabel(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Sorted, comma-separated permission labels for a list of bit names. */
function formatPermissionList(names: string[]): string {
  return names.map(permissionLabel).sort().join(", ");
}

/**
 * A permission target and its names on their own, e.g.
 * `@everyone ✘ View Channel`. Marks each name with the state it holds:
 * `✓` allowed, `✘` denied, `⬤` neutral (in neither list, so the overwrite
 * no longer sets it). An empty group contributes nothing.
 */
export function permissionContent(
  target: string,
  allow: string[],
  deny: string[],
  neutral: string[] = []
): string {
  let content = target;
  if (allow.length > 0) {
    content += ` ✓ ${formatPermissionList(allow)}`;
  }
  if (deny.length > 0) {
    content += ` ✘ ${formatPermissionList(deny)}`;
  }
  if (neutral.length > 0) {
    content += ` ⬤ ${formatPermissionList(neutral)}`;
  }
  return content;
}

/** A permission target as a bulleted line, e.g. `**➜** @everyone ✘ View Channel`. */
export function permissionLine(
  target: string,
  allow: string[],
  deny: string[],
  neutral: string[] = []
): string {
  return `${Constants.bullet} ${permissionContent(target, allow, deny, neutral)}`;
}

/**
 * The system channel messages a guild has suppressed, as a readable list.
 * An empty list is "None", meaning every notification is on.
 */
export function formatSystemChannelFlags(flags: Readonly<SystemChannelFlagsBitField>): string {
  const active = flags.toArray();
  return active.length > 0 ? formatPermissionList(active) : "None";
}
