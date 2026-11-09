import { ChannelType, GuildVerificationLevel, PermissionsBitField } from "discord.js";
import type { JsonValue } from "../db/schemas/guild-settings";
import { formatDuration } from "../lib/time";

const MAX_TEXT_LENGTH = 150;
export const NONE = "*none*";

export function humanize(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function code(value: JsonValue): string {
  const text = String(value).replaceAll("`", "'");
  return `\`${text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 3)}...` : text}\``;
}

interface FieldFormat {
  label: string;
  value(value: JsonValue): string;
  /** Overrides the default `before → after` for fields where a diff reads better. */
  change?(before: JsonValue | null, after: JsonValue | null): string;
}

const text = (label: string): FieldFormat => ({ label, value: code });
const channel = (label: string): FieldFormat => ({ label, value: value => `<#${value}>` });
const member = (label: string): FieldFormat => ({ label, value: value => `<@${value}>` });
const toggle = (label: string): FieldFormat => ({ label, value: value => (value ? "On" : "Off") });
const seconds = (label: string, zero: string): FieldFormat => ({
  label,
  value: value => (Number(value) === 0 ? zero : formatDuration(Number(value) * 1000)),
});
const asset = (label: string): FieldFormat => ({ label, value: () => "set", change: () => "changed" });

const permissionNames = (value: JsonValue | null): PermissionsBitField =>
  new PermissionsBitField(BigInt(String(value ?? 0)));

const PERMISSIONS: FieldFormat = {
  label: "Permissions",
  value: value => `${permissionNames(value).toArray().length} enabled`,
  change: (before, after) => {
    const [from, to] = [permissionNames(before), permissionNames(after)];
    const granted = from.missing(to).map(name => `+${humanize(name)}`);
    const revoked = to.missing(from).map(name => `-${humanize(name)}`);
    return [...granted, ...revoked].join(", ") || "changed";
  },
};

/** How each recorded field is labelled and rendered; an unknown key falls back to its own name. */
const FIELDS: Record<string, FieldFormat> = {
  name: text("Name"),
  topic: text("Topic"),
  description: text("Description"),
  tags: text("Tags"),
  type: { label: "Type", value: value => humanize(ChannelType[Number(value)] ?? String(value)) },
  parentId: {
    label: "Category",
    value: value => `<#${value}>`,
    change: (_, after) => (after === null ? "Moved out of its category" : `Moved to <#${after}>`),
  },
  nsfw: toggle("Age-restricted"),
  slowmode: seconds("Slowmode", "Off"),
  color: text("Colour"),
  hoist: toggle("Shown separately"),
  mentionable: toggle("Mentionable"),
  permissions: PERMISSIONS,
  animated: toggle("Animated"),
  archived: toggle("Archived"),
  locked: toggle("Locked"),
  autoArchiveMinutes: { label: "Auto-archive", value: value => formatDuration(Number(value) * 60_000) },
  icon: asset("Icon"),
  banner: asset("Banner"),
  splash: asset("Splash"),
  ownerId: member("Owner"),
  vanityCode: text("Vanity URL"),
  verificationLevel: {
    label: "Verification",
    value: value => humanize(GuildVerificationLevel[Number(value)] ?? String(value)),
  },
  afkChannelId: channel("AFK channel"),
  systemChannelId: channel("System channel"),
  channelId: channel("Channel"),
  inviterId: member("Inviter"),
  maxUses: { label: "Max uses", value: value => (Number(value) === 0 ? "Unlimited" : String(value)) },
  maxAgeSeconds: seconds("Expires after", "Never"),
  reason: text("Reason"),
};

export function show(value: JsonValue | null, format?: FieldFormat): string {
  return value === null || value === "" ? NONE : (format?.value(value) ?? code(value));
}

/** `before → after`, or a sentence when one side is unset (`null`). */
export function transition(from: string | null, to: string | null): string {
  if (from === null) {
    return `Set to ${to ?? NONE}`;
  }
  return to === null ? `Cleared (was ${from})` : `${from} → ${to}`;
}

export function changeLine(from: JsonValue | null, to: JsonValue | null, format?: FieldFormat): string {
  const render = (value: JsonValue | null): string | null =>
    value === null || value === "" ? null : show(value, format);
  return transition(render(from), render(to));
}

/**
 * One line per recorded field: a snapshot (create/delete) lists the values
 * that are set, an update shows `before → after` for what changed.
 */
export function fieldLines(oldValue: JsonValue | null, newValue: JsonValue | null): string[] {
  const asObject = (value: JsonValue | null): Record<string, JsonValue> =>
    value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  const [before, after] = [asObject(oldValue), asObject(newValue)];
  const snapshot = oldValue === null || newValue === null;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.flatMap(key => {
    const format = FIELDS[key];
    const label = `**${format?.label ?? key}**`;
    const [from, to] = [before[key] ?? null, after[key] ?? null];
    if (snapshot) {
      const present = to ?? from;
      return present === null || present === "" ? [] : [`${label}: ${show(present, format)}`];
    }
    return [`${label}: ${format?.change?.(from, to) ?? changeLine(from, to, format)}`];
  });
}
