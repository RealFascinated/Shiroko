import type { JsonValue } from "@/db/schemas/guild-settings";
import { formatDuration } from "@/lib/time";
import { PermissionFlags } from "@/permission/permissions";
import GuildSettings from "@/settings/guild-settings";
import SettingsManager from "@/settings/index";
import type { RuntimeFieldDescriptor } from "@/settings/settings-module";
import type { AuditEntry } from "@/audit/audit-kind";
import GuildAuditKind from "@/audit/guild-audit-kind";
import type { AuditActor } from "@/audit/audit-writer";

const MAX_VALUE_LENGTH = 100;

/**
 * Entries for `guild_settings` rows. The key is the stored key
 * (`<moduleId>.<path>`), so a revert writes the old value back to that key.
 */
export default class SettingsKind extends GuildAuditKind {
  public readonly id: string = "settings";
  public readonly label: string = "Setting changed";
  public override readonly revertFlags: bigint = PermissionFlags.SETTINGS_COMMAND;

  protected override mention(subjectId: string): string {
    const setting = resolve(subjectId);
    return setting ? `**${setting.labels.join(" › ")}**` : `\`${subjectId}\``;
  }

  protected override details(row: AuditEntry): string[] {
    const descriptor = resolve(row.subjectId)?.descriptor;
    return [`${formatValue(descriptor, row.oldValue)} → ${formatValue(descriptor, row.newValue)}`];
  }

  public override async revert(row: AuditEntry, actor: AuditActor): Promise<void> {
    await GuildSettings.set(actor.guild.id, row.subjectId, row.oldValue, actor);
  }
}

/**
 * Walk a stored key (`<moduleId>.<path>`) to its descriptor, collecting the
 * label of each step. A map's entry key is dynamic, so the segment after a
 * map selects its `entry` descriptor and is shown as-is.
 */
function resolve(subjectId: string): { descriptor: RuntimeFieldDescriptor; labels: string[] } | undefined {
  const [moduleId = "", first, ...rest] = subjectId.split(".");
  const module = SettingsManager.get(moduleId);
  let current = module?.runtimeDescriptors.find(descriptor => descriptor.key === first);
  if (!module || !current) {
    return undefined;
  }
  const labels = [module.displayName, current.label];
  for (const segment of rest) {
    const inMap: boolean = current.type === "map";
    current = inMap ? current.entry : current.fields?.find(field => field.key === segment);
    if (!current) {
      return undefined;
    }
    labels.push(inMap ? segment : current.label);
  }
  return { descriptor: current, labels };
}

function formatValue(descriptor: RuntimeFieldDescriptor | undefined, value: JsonValue | null): string {
  if (value === null) {
    return "*default*";
  }
  const text = render(descriptor, value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH - 3)}...` : text;
}

function render(descriptor: RuntimeFieldDescriptor | undefined, value: JsonValue): string {
  if (descriptor?.format) {
    return descriptor.format(value);
  }
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
