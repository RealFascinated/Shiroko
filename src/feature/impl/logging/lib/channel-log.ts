import { Constants } from "@/constants";
import { yesNo } from "@/lib/format";
import {
  ChannelType,
  type Guild,
  type NonThreadGuildBasedChannel,
  type PermissionOverwrites,
} from "discord.js";
import {
  changeDetail,
  changeLine,
  channelMention,
  code,
  detailLine,
  enumLabel,
  permissionContent,
  permissionLabel,
  permissionLine,
} from "./text";

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  [ChannelType.GuildText]: "Text",
  [ChannelType.GuildVoice]: "Voice",
  [ChannelType.GuildCategory]: "Category",
  [ChannelType.GuildAnnouncement]: "Announcement",
  [ChannelType.GuildStageVoice]: "Stage",
  [ChannelType.GuildForum]: "Forum",
  [ChannelType.GuildMedia]: "Media",
};

/**
 * One changed channel field. `summary` and `detail` render the focused
 * embed used when this is the only change; `line` is the labelled form used
 * when several fields changed at once.
 */
export interface ChannelChange {
  /** The change phrased to lead the focused title, e.g. "Topic changed". */
  summary: string;
  /** The change on its own, e.g. "`a` → `b`". */
  detail: string;
  /** The change as a labelled line, e.g. "**➜** Name: `a` → `b`". */
  line: string;
}

function fieldChange(summary: string, label: string, before: string, after: string): ChannelChange {
  return { summary, detail: changeDetail(before, after), line: changeLine(label, before, after) };
}

/**
 * A channel update split by how it renders: field changes first, then
 * permission overwrites, which trail the others under their own header.
 */
export interface ChannelChanges {
  /** Name, type, category, topic, slow mode, and NSFW changes. */
  fields: ChannelChange[];
  /** Permission overwrite changes, rendered after the fields. */
  permissions: ChannelChange[];
}

/** Introduces the overwrite lines when the log also reports other fields. */
const PERMISSION_CHANGES_LINE = `${Constants.bullet} Permission Changes:`;

/** How each overwrite action reads in a focused title. */
const PERMISSION_SUMMARIES: Record<"Added" | "Removed" | "Updated", string> = {
  Added: "Permissions added",
  Removed: "Permissions removed",
  Updated: "Permissions changed",
};

/**
 * A permission overwrite change. The focused form names the target once, so
 * the summary carries only the action while `detail` carries the target and
 * its new states.
 */
function permissionChange(
  verb: "Added" | "Removed" | "Updated",
  target: string,
  allow: string[],
  deny: string[],
  neutral: string[] = []
): ChannelChange {
  // An update's states already read as the change on their own. Added and
  // removed overwrites do not: their states are the new or former access,
  // so the verb is what says which way the access moved.
  const lineTarget = verb === "Updated" ? target : `${verb} permissions for ${target}`;
  return {
    summary: PERMISSION_SUMMARIES[verb],
    detail: permissionContent(target, allow, deny, neutral),
    line: permissionLine(lineTarget, allow, deny, neutral),
  };
}

export function channelLabel(channel: NonThreadGuildBasedChannel): string {
  return channel.type === ChannelType.GuildCategory
    ? `Category ${code(channel.name)}`
    : channelMention(channel.id);
}

export function channelTypeLabel(type: number): string {
  return enumLabel(CHANNEL_TYPE_NAMES, type, "Unknown");
}

/**
 * Name the target of a channel permission overwrite, falling back to the
 * raw id when the role or member is no longer in the cache.
 */
function formatOverwriteTarget(guild: Guild, id: string): string {
  return guild.roles.cache.get(id)?.toString() ?? guild.members.cache.get(id)?.toString() ?? code(id);
}

/**
 * Orders overwrite targets by their rendered name, so a log lists them
 * consistently.
 */
function byTargetName(guild: Guild): (a: string, b: string) => number {
  return (a, b) => formatOverwriteTarget(guild, a).localeCompare(formatOverwriteTarget(guild, b));
}

/**
 * Details worth logging on channel create: the parent and the text-only
 * fields when present (topic and slow mode). Guards on each concrete type,
 * since only text channels carry a topic.
 */
export function channelDetails(channel: NonThreadGuildBasedChannel): string[] {
  const lines: string[] = [];
  if ("parent" in channel && channel.parent) {
    lines.push(detailLine("Category", code(channel.parent.name)));
  }
  if ("topic" in channel && channel.topic) {
    lines.push(detailLine("Topic", channel.topic));
  }
  if ("rateLimitPerUser" in channel && channel.rateLimitPerUser) {
    lines.push(detailLine("Slow Mode", `${channel.rateLimitPerUser}s`));
  }
  return lines;
}

/**
 * An overwrite as one ready-to-print line: the target followed by its
 * allowed (`✓`) and denied (`✘`) permissions. Whichever group is empty is
 * omitted, so an overwrite never pads the log with blank sections. Reports
 * "None" when the channel has no overwrites, and a target that is no longer
 * cached falls back to its id.
 */
export function channelOverwriteLines(channel: NonThreadGuildBasedChannel): string[] {
  const entries = [...channel.permissionOverwrites.cache.entries()];
  const compare = byTargetName(channel.guild);
  entries.sort(([a], [b]) => compare(a, b));
  if (entries.length === 0) {
    return [detailLine("Permission Overwrites", "None")];
  }
  return entries.map(([id, overwrite]) =>
    permissionLine(
      formatOverwriteTarget(channel.guild, id),
      overwrite.allow.toArray(),
      overwrite.deny.toArray()
    )
  );
}

/**
 * Map every permission named in an overwrite's allow or deny to its state,
 * `allowed` or `denied`. Absence from the map means neutral.
 */
function overwriteStates(overwrite: PermissionOverwrites): Map<string, string> {
  const states = new Map<string, string>();
  for (const name of overwrite.allow.toArray()) {
    states.set(name, "allowed");
  }
  for (const name of overwrite.deny.toArray()) {
    states.set(name, "denied");
  }
  return states;
}

/**
 * Render a permission overwrite's tri-state transition. Every permission is
 * neutral (in neither field), allowed, or denied, so a change is a set of
 * entries that moved between those states. Diffing only the allow field
 * would miss neutral-to-deny and deny-to-neutral moves entirely, and would
 * mislabel the other transitions.
 */
function formatOverwriteTransitions(
  before: PermissionOverwrites,
  after: PermissionOverwrites
): Array<[string, string]> {
  const beforeStates = overwriteStates(before);
  const afterStates = overwriteStates(after);
  const rows: Array<[string, string]> = [];
  const names = [...new Set([...beforeStates.keys(), ...afterStates.keys()])].sort((a, b) =>
    permissionLabel(a).localeCompare(permissionLabel(b))
  );
  for (const name of names) {
    const from = beforeStates.get(name) ?? "neutral";
    const to = afterStates.get(name) ?? "neutral";
    if (from !== to) {
      rows.push([permissionLabel(name), to]);
    }
  }
  return rows;
}

/**
 * Permission overwrite changes, one per target: the target followed by the
 * state each changed permission now holds, `✓` allowed, `✘` denied, or `⬤`
 * neutral when the overwrite stopped setting it. A target with nothing to
 * report produces no entry at all, so unchanged overwrites never appear, and
 * an empty group is omitted rather than printed as "none".
 */
function describeOverwriteBlocks(
  oldChannel: NonThreadGuildBasedChannel,
  newChannel: NonThreadGuildBasedChannel
): ChannelChange[] {
  const changes: ChannelChange[] = [];
  const oldOverwrites = oldChannel.permissionOverwrites.cache;
  const newOverwrites = newChannel.permissionOverwrites.cache;
  const ids = [...new Set([...oldOverwrites.keys(), ...newOverwrites.keys()])].sort(
    byTargetName(newChannel.guild)
  );
  for (const id of ids) {
    const before = oldOverwrites.get(id);
    const after = newOverwrites.get(id);
    const target = formatOverwriteTarget(newChannel.guild, id);
    if (!before && after) {
      changes.push(permissionChange("Added", target, after.allow.toArray(), after.deny.toArray()));
      continue;
    }
    if (before && !after) {
      changes.push(permissionChange("Removed", target, before.allow.toArray(), before.deny.toArray()));
      continue;
    }
    if (!before || !after) {
      continue;
    }
    const transitions = formatOverwriteTransitions(before, after);
    if (transitions.length === 0) {
      continue;
    }
    changes.push(
      permissionChange(
        "Updated",
        target,
        transitions.filter(([, to]) => to === "allowed").map(([name]) => name),
        transitions.filter(([, to]) => to === "denied").map(([name]) => name),
        transitions.filter(([, to]) => to === "neutral").map(([name]) => name)
      )
    );
  }
  return changes;
}

/**
 * The fields of a channel update that changed, split into field changes and
 * permission overwrites. Fields are read through `in` guards because they
 * only exist on some channel types.
 *
 * This reports what the channel payload itself changed, not anyone's
 * resulting access: a role edit, a category overwrite edit propagating to
 * children, or a position change that reorders the hierarchy each alter
 * effective permissions without producing a diff here.
 */
export function describeChannelChanges(
  oldChannel: NonThreadGuildBasedChannel,
  newChannel: NonThreadGuildBasedChannel
): ChannelChanges {
  const fields: ChannelChange[] = [];
  if (oldChannel.name !== newChannel.name) {
    fields.push(fieldChange("Name changed", "Name", code(oldChannel.name), code(newChannel.name)));
  }
  if (oldChannel.type !== newChannel.type) {
    fields.push(
      fieldChange(
        "Type changed",
        "Type",
        channelTypeLabel(oldChannel.type),
        channelTypeLabel(newChannel.type)
      )
    );
  }
  const oldParent = "parent" in oldChannel ? oldChannel.parent : null;
  const newParent = "parent" in newChannel ? newChannel.parent : null;
  if (oldParent?.id !== newParent?.id) {
    fields.push(
      fieldChange(
        "Category changed",
        "Category",
        oldParent ? code(oldParent.name) : "None",
        newParent ? code(newParent.name) : "None"
      )
    );
  }
  if ("topic" in oldChannel && "topic" in newChannel && oldChannel.topic !== newChannel.topic) {
    fields.push(
      fieldChange("Topic changed", "Topic", oldChannel.topic ?? "None", newChannel.topic ?? "None")
    );
  }
  if ("rateLimitPerUser" in oldChannel && "rateLimitPerUser" in newChannel) {
    const oldSlowMode = oldChannel.rateLimitPerUser ?? 0;
    const newSlowMode = newChannel.rateLimitPerUser ?? 0;
    if (oldSlowMode !== newSlowMode) {
      fields.push(fieldChange("Slow mode changed", "Slow Mode", `${oldSlowMode}s`, `${newSlowMode}s`));
    }
  }
  if ("nsfw" in oldChannel && "nsfw" in newChannel && oldChannel.nsfw !== newChannel.nsfw) {
    fields.push(fieldChange("NSFW setting changed", "NSFW", yesNo(oldChannel.nsfw), yesNo(newChannel.nsfw)));
  }
  return { fields, permissions: describeOverwriteBlocks(oldChannel, newChannel) };
}

/**
 * The description lines for a channel-update log. A single change is named
 * directly (`<channel>'s name was updated`) with its before/after beneath.
 * Several changes share the generic header, with the overwrites trailing
 * under a `Permission Changes:` line. An unchanged channel yields no lines.
 */
export function channelUpdateLines(channel: NonThreadGuildBasedChannel, changes: ChannelChanges): string[] {
  const all = [...changes.fields, ...changes.permissions];
  if (all.length === 0) {
    return [];
  }
  const label = channelLabel(channel);
  if (all.length === 1) {
    const change = all[0]!;
    return [`${change.summary} for ${label}.`, "", change.detail];
  }
  const lines = [`${label} was updated.`, "", ...changes.fields.map(change => change.line)];
  if (changes.permissions.length > 0) {
    if (changes.fields.length > 0) {
      lines.push(PERMISSION_CHANGES_LINE);
    }
    lines.push(...changes.permissions.map(change => change.line));
  }
  return lines;
}
