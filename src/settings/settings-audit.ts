import AuditKind from "../audit/audit-kind";
import type { AuditActor } from "../audit/audit-log";
import type { GuildAuditLogSchema } from "../db/schemas/guild-audit-log";
import type { JsonValue } from "../db/schemas/guild-settings";
import { formatDuration } from "../lib/time";
import { PermissionFlags } from "../permission/permissions";
import GuildSettings from "./guild-settings";
import SettingsManager from "./index";
import type SettingsModule from "./settings-module";
import type { RuntimeFieldDescriptor } from "./settings-module";

const MAX_VALUE_LENGTH = 100;

/**
 * Entries for `guild_settings` rows. The key is the stored key
 * (`<moduleId>.<path>`), so a revert writes the old value back to that key.
 */
export default class SettingsAuditKind extends AuditKind {
  public readonly id: string = "settings";
  public readonly revertFlags: bigint = PermissionFlags.SETTINGS_COMMAND;

  public describe(entry: GuildAuditLogSchema): string {
    const [moduleId = "", ...path] = entry.key.split(".");
    const module = SettingsManager.get(moduleId);
    const descriptor = module ? descriptorAt(module, path) : undefined;
    return `\`${entry.key}\`: ${formatValue(descriptor, entry.oldValue)} → ${formatValue(descriptor, entry.newValue)}`;
  }

  public async revert(entry: GuildAuditLogSchema, actor: AuditActor): Promise<void> {
    await GuildSettings.set(entry.guildId, entry.key, entry.oldValue, actor);
  }
}

/**
 * Walk a stored key's path to its descriptor. A map's entry key is
 * dynamic, so the segment after a map selects its `entry` descriptor.
 */
function descriptorAt(module: SettingsModule<any>, path: string[]): RuntimeFieldDescriptor | undefined {
  let current = module.runtimeDescriptors.find(descriptor => descriptor.key === path[0]);
  for (const segment of path.slice(1)) {
    if (!current) {
      return undefined;
    }
    current = current.type === "map" ? current.entry : current.fields?.find(field => field.key === segment);
  }
  return current;
}

function formatValue(descriptor: RuntimeFieldDescriptor | undefined, value: JsonValue | null): string {
  if (value === null) {
    return "*default*";
  }
  const text = render(descriptor, value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH - 3)}...` : text;
}

function render(descriptor: RuntimeFieldDescriptor | undefined, value: JsonValue): string {
  switch (descriptor?.type) {
    case "boolean":
      return value ? "On" : "Off";
    case "channel":
      return `<#${value}>`;
    case "role":
      return `<@&${value}>`;
    case "role-list":
      return (value as string[]).map(id => `<@&${id}>`).join(", ") || "*none*";
    case "duration":
      return formatDuration(Number(value));
    case "choice":
      return descriptor.choices?.[String(value)] ?? String(value);
    case "string-list":
      return (value as string[]).join(", ") || "*none*";
    default:
      return `\`${(typeof value === "string" ? value : JSON.stringify(value)).replaceAll("`", "'")}\``;
  }
}
