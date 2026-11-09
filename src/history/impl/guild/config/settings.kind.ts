import type { JsonValue } from "@/db/schemas/guild-settings";
import { formatDuration } from "@/lib/time";
import { PermissionFlags } from "@/permission/permissions";
import GuildSettings from "@/settings/guild-settings";
import SettingsManager from "@/settings/index";
import type SettingsModule from "@/settings/settings-module";
import type { RuntimeFieldDescriptor } from "@/settings/settings-module";
import type { HistoryEntry } from "@/history/history-kind";
import GuildHistoryKind from "@/history/guild-history-kind";
import type { HistoryActor } from "@/history/history-writer";

const MAX_VALUE_LENGTH = 100;

/**
 * Entries for `guild_settings` rows. The key is the stored key
 * (`<moduleId>.<path>`), so a revert writes the old value back to that key.
 */
export default class SettingsKind extends GuildHistoryKind {
  public readonly id: string = "settings";
  public readonly label: string = "Setting changed";
  public override readonly revertFlags: bigint = PermissionFlags.SETTINGS_COMMAND;

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }

  protected override details(row: HistoryEntry): string[] {
    const [moduleId = "", ...path] = row.subjectId.split(".");
    const module = SettingsManager.get(moduleId);
    const descriptor = module ? descriptorAt(module, path) : undefined;
    return [`${formatValue(descriptor, row.oldValue)} → ${formatValue(descriptor, row.newValue)}`];
  }

  public override async revert(row: HistoryEntry, actor: HistoryActor): Promise<void> {
    await GuildSettings.set(actor.guild.id, row.subjectId, row.oldValue, actor);
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
