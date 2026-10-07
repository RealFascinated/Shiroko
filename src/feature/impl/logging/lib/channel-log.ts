import { yesNo } from "@/lib/format";
import {
  ChannelType,
  type Guild,
  type NonThreadGuildBasedChannel,
  type PermissionOverwrites,
} from "discord.js";
import {
  changeLine,
  channelMention,
  code,
  detailLine,
  enumLabel,
  permissionLabel,
  permissionLine,
} from "./text";

/** User-facing names for Discord's channel types. */
const CHANNEL_TYPE_NAMES: Record<number, string> = {
  [ChannelType.GuildText]: "Text",
  [ChannelType.GuildVoice]: "Voice",
  [ChannelType.GuildCategory]: "Category",
  [ChannelType.GuildAnnouncement]: "Announcement",
  [ChannelType.GuildStageVoice]: "Stage",
  [ChannelType.GuildForum]: "Forum",
  [ChannelType.GuildMedia]: "Media",
};

/** How a channel is named in a log: its mention, or its name once deleted. */
export function channelLabel(channel: NonThreadGuildBasedChannel): string {
  return channel.type === ChannelType.GuildCategory
    ? `Category ${code(channel.name)}`
    : channelMention(channel.id);
}

/** A channel type as its user-facing name, falling back to "Unknown". */
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
 * Permission overwrite changes as one line per target: the target followed
 * by the state each changed permission now holds, `✓` allowed, `✘` denied,
 * or `⬤` neutral when the overwrite stopped setting it. A target with
 * nothing to report produces no lines at all, so unchanged overwrites never
 * appear, and an empty group is omitted rather than printed as "none".
 */
function describeOverwriteBlocks(
  oldChannel: NonThreadGuildBasedChannel,
  newChannel: NonThreadGuildBasedChannel
): string[] {
  const lines: string[] = [];
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
      lines.push(
        permissionLine(`Added permissions for ${target}`, after.allow.toArray(), after.deny.toArray())
      );
      continue;
    }
    if (before && !after) {
      lines.push(
        permissionLine(`Removed permissions for ${target}`, before.allow.toArray(), before.deny.toArray())
      );
      continue;
    }
    if (!before || !after) {
      continue;
    }
    const transitions = formatOverwriteTransitions(before, after);
    if (transitions.length === 0) {
      continue;
    }
    lines.push(
      permissionLine(
        `Updated permissions for ${target}`,
        transitions.filter(([, to]) => to === "allowed").map(([name]) => name),
        transitions.filter(([, to]) => to === "denied").map(([name]) => name),
        transitions.filter(([, to]) => to === "neutral").map(([name]) => name)
      )
    );
  }
  return lines;
}

/**
 * The fields of a channel update that changed, as ready-to-print lines.
 * Fields are read through `in` guards because they only exist on some
 * channel types.
 *
 * This reports what the channel payload itself changed, not anyone's
 * resulting access: a role edit, a category overwrite edit propagating to
 * children, or a position change that reorders the hierarchy each alter
 * effective permissions without producing a diff here.
 */
export function describeChannelChanges(
  oldChannel: NonThreadGuildBasedChannel,
  newChannel: NonThreadGuildBasedChannel
): string[] {
  const lines: string[] = [];
  if (oldChannel.name !== newChannel.name) {
    lines.push(changeLine("Name", code(oldChannel.name), code(newChannel.name)));
  }
  if (oldChannel.type !== newChannel.type) {
    lines.push(changeLine("Type", channelTypeLabel(oldChannel.type), channelTypeLabel(newChannel.type)));
  }
  const oldParent = "parent" in oldChannel ? oldChannel.parent : null;
  const newParent = "parent" in newChannel ? newChannel.parent : null;
  if (oldParent?.id !== newParent?.id) {
    lines.push(
      changeLine(
        "Category",
        oldParent ? code(oldParent.name) : "None",
        newParent ? code(newParent.name) : "None"
      )
    );
  }
  if ("topic" in oldChannel && "topic" in newChannel && oldChannel.topic !== newChannel.topic) {
    lines.push(changeLine("Topic", oldChannel.topic ?? "None", newChannel.topic ?? "None"));
  }
  if ("rateLimitPerUser" in oldChannel && "rateLimitPerUser" in newChannel) {
    const oldSlowMode = oldChannel.rateLimitPerUser ?? 0;
    const newSlowMode = newChannel.rateLimitPerUser ?? 0;
    if (oldSlowMode !== newSlowMode) {
      lines.push(changeLine("Slow Mode", `${oldSlowMode}s`, `${newSlowMode}s`));
    }
  }
  if ("nsfw" in oldChannel && "nsfw" in newChannel && oldChannel.nsfw !== newChannel.nsfw) {
    lines.push(changeLine("NSFW", yesNo(oldChannel.nsfw), yesNo(newChannel.nsfw)));
  }
  lines.push(...describeOverwriteBlocks(oldChannel, newChannel));
  return lines;
}
