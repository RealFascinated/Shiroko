import type Event from "@/event/event";
import { EventBus } from "@/event/event-bus";
import ChannelCreatedEvent from "@/event/events/channel-created.event";
import ChannelDeletedEvent from "@/event/events/channel-deleted.event";
import ChannelUpdatedEvent from "@/event/events/channel-updated.event";
import EmojiCreatedEvent from "@/event/events/emoji-created.event";
import EmojiDeletedEvent from "@/event/events/emoji-deleted.event";
import EmojiUpdatedEvent from "@/event/events/emoji-updated.event";
import GuildUpdatedEvent from "@/event/events/guild-updated.event";
import InviteCreatedEvent from "@/event/events/invite-created.event";
import InviteDeletedEvent from "@/event/events/invite-deleted.event";
import MemberBannedEvent from "@/event/events/member-banned.event";
import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import MemberGuildLeaveEvent from "@/event/events/member-guild-leave.event";
import MemberNicknameUpdatedEvent from "@/event/events/member-nickname-updated.event";
import MemberRolesUpdatedEvent from "@/event/events/member-roles-updated.event";
import RoleCreatedEvent from "@/event/events/role-created.event";
import RoleDeletedEvent from "@/event/events/role-deleted.event";
import RoleUpdatedEvent from "@/event/events/role-updated.event";
import StickerCreatedEvent from "@/event/events/sticker-created.event";
import StickerDeletedEvent from "@/event/events/sticker-deleted.event";
import StickerUpdatedEvent from "@/event/events/sticker-updated.event";
import UserAvatarUpdatedEvent from "@/event/events/user-avatar-updated.event";
import UserBannerUpdatedEvent from "@/event/events/user-banner-updated.event";
import UserDisplayNameUpdatedEvent from "@/event/events/user-display-name-updated.event";
import UserUsernameUpdatedEvent from "@/event/events/user-username-updated.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import { baseEmbed } from "@/lib/embed";
import { yesNo } from "@/lib/format";
import SettingsManager from "@/settings/index";
import {
  ChannelType,
  EmbedBuilder,
  GuildVerificationLevel,
  StickerFormatType,
  type Guild,
  type GuildEmoji,
  type NonThreadGuildBasedChannel,
  type PermissionOverwrites,
  type Role,
  type Sticker,
  type TextChannel,
} from "discord.js";
import LoggingCommand from "./command/logging/logging.command";
import type { LogType } from "./log-type";
import { loggingSettings } from "./logging-settings";
import { loggingService } from "./logging.service";

/** User-facing names for Discord's guild verification levels. */
const VERIFICATION_LEVEL_NAMES: Record<number, string> = {
  [GuildVerificationLevel.None]: "None",
  [GuildVerificationLevel.Low]: "Low",
  [GuildVerificationLevel.Medium]: "Medium",
  [GuildVerificationLevel.High]: "High",
  [GuildVerificationLevel.VeryHigh]: "Very High",
};

/** User-facing names for Discord's sticker formats. */
const STICKER_FORMAT_NAMES: Record<number, string> = {
  [StickerFormatType.PNG]: "PNG",
  [StickerFormatType.APNG]: "APNG",
  [StickerFormatType.Lottie]: "Lottie",
  [StickerFormatType.GIF]: "GIF",
};

function formatRoleIds(roleIds: string[]): string {
  return roleIds.length > 0 ? roleIds.map(id => `<@&${id}>`).join(", ") : "None";
}

/** Render a stored asset URL as a markdown link, or "None" when absent. */
function assetLink(url: string | null, type: "before" | "after"): string {
  return url ? `[[${type}]](${url})` : "Unknown";
}

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
function channelLabel(channel: NonThreadGuildBasedChannel): string {
  return channel.type === ChannelType.GuildCategory ? `Category \`${channel.name}\`` : `<#${channel.id}>`;
}

/**
 * Name the target of a channel permission overwrite, falling back to the
 * raw id when the role or member is no longer in the cache.
 */
function formatOverwriteTarget(guild: Guild, id: string): string {
  return guild.roles.cache.get(id)?.toString() ?? guild.members.cache.get(id)?.toString() ?? `\`${id}\``;
}

/**
 * Details worth logging on channel create: the parent and the text-only
 * fields when present (topic and slow mode). Guards on each concrete type,
 * since only text channels carry a topic.
 */
function channelDetails(channel: NonThreadGuildBasedChannel): Array<[string, string]> {
  const details: Array<[string, string]> = [];
  if ("parent" in channel && channel.parent) {
    details.push(["Category", `\`${channel.parent.name}\``]);
  }
  if ("topic" in channel && channel.topic) {
    details.push(["Topic", channel.topic]);
  }
  if ("rateLimitPerUser" in channel && channel.rateLimitPerUser) {
    details.push(["Slow Mode", `${channel.rateLimitPerUser}s`]);
  }
  return details;
}

/**
 * The channel's permission overwrites as ready-to-print embed lines: one
 * header per target followed by its allowed and denied permissions, nested
 * like the update log's diff. Reports "None" when the channel has no
 * overwrites, and a target that is no longer cached falls back to its id.
 */
function channelOverwriteLines(channel: NonThreadGuildBasedChannel): string[] {
  const targets = [...channel.permissionOverwrites.cache.entries()].sort(([a], [b]) =>
    formatOverwriteTarget(channel.guild, a).localeCompare(formatOverwriteTarget(channel.guild, b))
  );
  if (targets.length === 0) {
    return ["**➜** Permission Overwrites: None"];
  }
  const lines: string[] = [];
  for (const [id, overwrite] of targets) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(
      `**➜** Added permissions for ${formatOverwriteTarget(channel.guild, id)}`,
      ...overwriteBlock(overwrite)
    );
  }
  return lines;
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
): Array<[string, string, string]> {
  const beforeStates = overwriteStates(before);
  const afterStates = overwriteStates(after);
  const rows: Array<[string, string, string]> = [];
  const names = [...new Set([...beforeStates.keys(), ...afterStates.keys()])].sort((a, b) =>
    permissionLabel(a).localeCompare(permissionLabel(b))
  );
  for (const name of names) {
    const from = beforeStates.get(name) ?? "neutral";
    const to = afterStates.get(name) ?? "neutral";
    if (from !== to) {
      rows.push([permissionLabel(name), from, to]);
    }
  }
  return rows;
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

/** Split the camelCase Discord uses in a permission name: `ManageGuild` -> `Manage Guild`. */
function permissionLabel(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * Render permission bit names as friendly labels, splitting the camelCase
 * Discord uses (`ManageGuild` becomes `Manage Guild`).
 */
function formatPermissionNames(names: string[]): string {
  return names.map(permissionLabel).join(", ");
}

export default class LoggingFeature extends Feature {
  constructor() {
    super(FeatureIds.Logging, { name: "Logging", emoji: "📔" });

    SettingsManager.register(loggingSettings);
    this.registerCommand(new LoggingCommand());

    this.handleEvent(MemberGuildJoinEvent, "member_join", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.member} joined the server.`,
            "",
            `**➜** ID: \`${event.member.id}\``,
            `**➜** Username: \`${event.member.user.username}\``,
            `**➜** Account Created: <t:${Math.floor(event.member.user.createdAt.getTime() / 1000)}>`,
          ]).setThumbnail(event.member.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberGuildLeaveEvent, "member_leave", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.member} left the server.`,
            "",
            `**➜** ID: \`${event.member.id}\``,
            `**➜** Username: \`${event.member.user.username}\``,
          ]).setThumbnail(event.member.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(UserAvatarUpdatedEvent, "avatar_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newUser} changed their avatar.`,
            "",
            `**➜** ID: \`${event.newUser.id}\``,
            `**➜** Username: \`${event.newUser.username}\``,
            `**➜** Avatar: ${assetLink(event.beforeAssetUrl, "before")} → ${assetLink(event.afterAssetUrl, "after")}`,
          ]).setThumbnail(event.afterAssetUrl),
        ],
      });
    });
    this.handleEvent(UserBannerUpdatedEvent, "banner_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            event.afterAssetUrl
              ? `${event.newUser} changed their banner.`
              : `${event.newUser} removed their banner.`,
            "",
            `**➜** ID: \`${event.newUser.id}\``,
            `**➜** Username: \`${event.newUser.username}\``,
            `**➜** Banner: ${assetLink(event.beforeAssetUrl, "before")} → ${assetLink(event.afterAssetUrl, "after")}`,
          ]).setImage(event.afterAssetUrl),
        ],
      });
    });
    this.handleEvent(UserUsernameUpdatedEvent, "username_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newUser} changed their username.`,
            "",
            `**➜** ID: \`${event.newUser.id}\``,
            `**➜** Before: \`${event.oldUser.username}\``,
            `**➜** After: \`${event.newUser.username}\``,
          ]).setThumbnail(event.newUser.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(UserDisplayNameUpdatedEvent, "display_name_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newUser} changed their display name.`,
            "",
            `**➜** ID: \`${event.newUser.id}\``,
            `**➜** Before: \`${event.oldUser.displayName}\``,
            `**➜** After: \`${event.newUser.displayName}\``,
          ]).setThumbnail(event.newUser.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberRolesUpdatedEvent, "member_roles", async (event, channel) => {
      if (event.added.size === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newMember} was given roles.`,
            "",
            `**➜** ID: \`${event.newMember.id}\``,
            `**➜** Roles: ${event.added.map(role => role.toString()).join(", ")}`,
          ]).setThumbnail(event.newMember.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberRolesUpdatedEvent, "member_roles", async (event, channel) => {
      if (event.removed.size === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newMember} had roles removed.`,
            "",
            `**➜** ID: \`${event.newMember.id}\``,
            `**➜** Roles: ${event.removed.map(role => role.toString()).join(", ")}`,
          ]).setThumbnail(event.newMember.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberNicknameUpdatedEvent, "nickname_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newMember} changed their nickname.`,
            "",
            `**➜** ID: \`${event.newMember.id}\``,
            `**➜** Before: \`${event.oldMember.nickname ?? "None"}\``,
            `**➜** After: \`${event.newMember.nickname ?? "Removed"}\``,
          ]).setThumbnail(event.newMember.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(GuildUpdatedEvent, "server_update", async (event, channel) => {
      const changes = this.describeGuildChanges(event.oldGuild, event.guildData);
      if (changes.length === 0) {
        return;
      }
      const embed = this.baseLogEmbed([
        `Server **${event.guildData.name}** was updated.`,
        "",
        ...changes.map(([label, before, after]) => `${label}: ${before} → ${after}`),
      ]);
      await channel.send({ embeds: [embed] });
    });

    this.handleEvent(ChannelCreatedEvent, "channel", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${channelLabel(event.channel)} was created.`,
            "",
            `**➜** Type: \`${CHANNEL_TYPE_NAMES[event.channel.type] ?? "Unknown"}\``,
            `**➜** ID: \`${event.channel.id}\``,
            ...channelDetails(event.channel).map(([label, value]) => `**➜** ${label}: ${value}`),
            ...channelOverwriteLines(event.channel),
          ]),
        ],
      });
    });

    this.handleEvent(ChannelUpdatedEvent, "channel", async (event, channel) => {
      const changes = this.describeChannelChanges(event.oldChannel, event.newChannel);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${channelLabel(event.newChannel)} was updated.`,
            "",
            `**➜** ID: \`${event.newChannel.id}\``,
            ...changes,
          ]),
        ],
      });
    });

    this.handleEvent(ChannelDeletedEvent, "channel", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Channel \`${event.channel.name}\` was deleted.`,
            "",
            `**➜** Type: \`${CHANNEL_TYPE_NAMES[event.channel.type] ?? "Unknown"}\``,
            `**➜** ID: \`${event.channel.id}\``,
          ]),
        ],
      });
    });

    this.handleEvent(RoleCreatedEvent, "role", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.role} was created.`,
            "",
            `**➜** ID: \`${event.role.id}\``,
            `**➜** Color: \`${event.role.hexColor}\``,
            `**➜** Hoisted: \`${yesNo(event.role.hoist)}\``,
            `**➜** Mentionable: \`${yesNo(event.role.mentionable)}\``,
          ]),
        ],
      });
    });

    this.handleEvent(RoleUpdatedEvent, "role", async (event, channel) => {
      const changes = this.describeRoleChanges(event.oldRole, event.newRole);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newRole} was updated.`,
            "",
            `**➜** ID: \`${event.newRole.id}\``,
            ...changes.map(([label, before, after]) => `${label}: ${before} → ${after}`),
          ]),
        ],
      });
    });

    this.handleEvent(RoleDeletedEvent, "role", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.role} was deleted.`,
            "",
            `**➜** ID: \`${event.role.id}\``,
            `**➜** Color: \`${event.role.hexColor}\``,
          ]),
        ],
      });
    });

    this.handleEvent(EmojiCreatedEvent, "emoji", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Emoji ${event.emoji} was created.`,
            "",
            `**➜** Name: \`${event.emoji.name}\``,
            `**➜** ID: \`${event.emoji.id}\``,
            `**➜** Animated: \`${yesNo(event.emoji.animated)}\``,
          ]).setThumbnail(event.emoji.imageURL({ size: 4096 })),
        ],
      });
    });

    this.handleEvent(EmojiUpdatedEvent, "emoji", async (event, channel) => {
      const changes = this.describeEmojiChanges(event.oldEmoji, event.newEmoji);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Emoji ${event.newEmoji} was updated.`,
            "",
            `**➜** ID: \`${event.newEmoji.id}\``,
            ...changes.map(([label, before, after]) => `${label}: ${before} → ${after}`),
          ]).setThumbnail(event.newEmoji.imageURL({ size: 4096 })),
        ],
      });
    });

    this.handleEvent(EmojiDeletedEvent, "emoji", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Emoji ${event.emoji} was deleted.`,
            "",
            `**➜** ID: \`${event.emoji.id}\``,
            `**➜** Animated: \`${yesNo(event.emoji.animated)}\``,
          ]).setThumbnail(event.emoji.imageURL({ size: 4096 })),
        ],
      });
    });

    this.handleEvent(StickerCreatedEvent, "sticker", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Sticker **${event.sticker.name}** was created.`,
            "",
            `**➜** ID: \`${event.sticker.id}\``,
            `**➜** Description: \`${event.sticker.description ?? "None"}\``,
            `**➜** Format: \`${STICKER_FORMAT_NAMES[event.sticker.format] ?? "Unknown"}\``,
            `**➜** Tags: \`${event.sticker.tags ?? "None"}\``,
          ]).setImage(event.sticker.url),
        ],
      });
    });

    this.handleEvent(StickerUpdatedEvent, "sticker", async (event, channel) => {
      const changes = this.describeStickerChanges(event.oldSticker, event.newSticker);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Sticker **${event.newSticker.name}** was updated.`,
            "",
            `**➜** ID: \`${event.newSticker.id}\``,
            ...changes.map(([label, before, after]) => `${label}: ${before} → ${after}`),
          ]).setImage(event.newSticker.url),
        ],
      });
    });

    this.handleEvent(StickerDeletedEvent, "sticker", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Sticker **${event.sticker.name}** was deleted.`,
            "",
            `**➜** ID: \`${event.sticker.id}\``,
            `**➜** Format: \`${STICKER_FORMAT_NAMES[event.sticker.format] ?? "Unknown"}\``,
          ]).setImage(event.sticker.url),
        ],
      });
    });

    this.handleEvent(MemberBannedEvent, "ban", async (event, channel) => {
      if (!event.banned) {
        return;
      }
      const { ban } = event;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${ban.user} was banned.`,
            "",
            `**➜** ID: \`${ban.user.id}\``,
            `**➜** Username: \`${ban.user.username}\``,
            `**➜** Reason: \`${ban.reason ?? "None"}\``,
          ]).setThumbnail(ban.user.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberBannedEvent, "ban", async (event, channel) => {
      if (event.banned) {
        return;
      }
      const { ban } = event;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${ban.user} was unbanned.`,
            "",
            `**➜** ID: \`${ban.user.id}\``,
            `**➜** Username: \`${ban.user.username}\``,
          ]).setThumbnail(ban.user.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(InviteCreatedEvent, "invite", async (event, channel) => {
      const { invite } = event;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.guild!.name}** had an invite created.`,
            "",
            `**➜** Code: \`${invite.code}\``,
            `**➜** Channel: \`${invite.channel ? `<#${invite.channel.id}>` : "unknown"}\``,
            `**➜** Expires: ${invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}>` : "never"}`,
          ]).setThumbnail(invite.inviter?.displayAvatarURL({ size: 4096, extension: "webp" }) ?? null),
        ],
      });
    });

    this.handleEvent(InviteDeletedEvent, "invite", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.guild!.name}** had an invite deleted.`,
            "",
            `**➜** Code: \`${event.invite.code}\``,
          ]),
        ],
      });
    });
  }

  /**
   * The guild's configured log channel, or `null` when unset or not a text
   * channel.
   */
  public async getLogsChannel(guild: Guild): Promise<TextChannel | null> {
    const channelId = await loggingService.getChannelId(guild);
    if (!channelId) {
      return null;
    }
    const channel = await guild.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }
    return channel;
  }

  public baseLogEmbed(descriptionLines: string[] = []): EmbedBuilder {
    return baseEmbed().setDescription(descriptionLines.join("\n")).setTimestamp(new Date());
  }

  /**
   * The fields of a sticker update that changed, as `[label, before, after]`
   * rows.
   */
  private describeStickerChanges(oldSticker: Sticker, newSticker: Sticker): Array<[string, string, string]> {
    const changes: Array<[string, string, string]> = [];
    if (oldSticker.name !== newSticker.name) {
      changes.push(["**➜** Name", oldSticker.name, newSticker.name]);
    }
    if (oldSticker.description !== newSticker.description) {
      changes.push(["**➜** Description", oldSticker.description ?? "None", newSticker.description ?? "None"]);
    }
    if (oldSticker.tags !== newSticker.tags) {
      changes.push(["**➜** Tags", oldSticker.tags ?? "None", newSticker.tags ?? "None"]);
    }
    return changes;
  }

  /**
   * The fields of an emoji update that changed, as `[label, before, after]`
   * rows.
   */
  private describeEmojiChanges(oldEmoji: GuildEmoji, newEmoji: GuildEmoji): Array<[string, string, string]> {
    const changes: Array<[string, string, string]> = [];
    if (oldEmoji.name !== newEmoji.name) {
      changes.push(["**➜** Name", oldEmoji.name ?? "None", newEmoji.name ?? "None"]);
    }
    if (oldEmoji.animated !== newEmoji.animated) {
      changes.push(["**➜** Animated", yesNo(oldEmoji.animated), yesNo(newEmoji.animated)]);
    }
    const oldRoles = formatRoleIds([...oldEmoji.roles.cache.keys()]);
    const newRoles = formatRoleIds([...newEmoji.roles.cache.keys()]);
    if (oldRoles !== newRoles) {
      changes.push(["**➜** Role Restriction", oldRoles, newRoles]);
    }
    return changes;
  }

  /**
   * The fields of a channel update that changed, as `[label, before, after]`
   * rows. Fields are read through `in` guards because they only exist on
   * some channel types.
   *
   * This reports what the channel payload itself changed, not anyone's
   * resulting access: a role edit, a category overwrite edit propagating to
   * children, or a position change that reorders the hierarchy each alter
   * effective permissions without producing a diff here.
   */
  private describeChannelChanges(
    oldChannel: NonThreadGuildBasedChannel,
    newChannel: NonThreadGuildBasedChannel
  ): string[] {
    const lines: string[] = [];
    if (oldChannel.name !== newChannel.name) {
      lines.push(`**➜** Name: \`${oldChannel.name}\` → \`${newChannel.name}\``);
    }
    if (oldChannel.type !== newChannel.type) {
      lines.push(
        `**➜** Type: ${CHANNEL_TYPE_NAMES[oldChannel.type] ?? String(oldChannel.type)} → ${
          CHANNEL_TYPE_NAMES[newChannel.type] ?? String(newChannel.type)
        }`
      );
    }
    const oldParent = "parent" in oldChannel ? oldChannel.parent : null;
    const newParent = "parent" in newChannel ? newChannel.parent : null;
    if (oldParent?.id !== newParent?.id) {
      lines.push(
        `**➜** Category: ${oldParent ? `\`${oldParent.name}\`` : "None"} → ${
          newParent ? `\`${newParent.name}\`` : "None"
        }`
      );
    }
    if ("topic" in oldChannel && "topic" in newChannel && oldChannel.topic !== newChannel.topic) {
      lines.push(`**➜** Topic: ${oldChannel.topic ?? "None"} → ${newChannel.topic ?? "None"}`);
    }
    if ("rateLimitPerUser" in oldChannel && "rateLimitPerUser" in newChannel) {
      const oldSlowMode = oldChannel.rateLimitPerUser ?? 0;
      const newSlowMode = newChannel.rateLimitPerUser ?? 0;
      if (oldSlowMode !== newSlowMode) {
        lines.push(`**➜** Slow Mode: ${oldSlowMode}s → ${newSlowMode}s`);
      }
    }
    if ("nsfw" in oldChannel && "nsfw" in newChannel && oldChannel.nsfw !== newChannel.nsfw) {
      lines.push(`**➜** NSFW: ${yesNo(oldChannel.nsfw)} → ${yesNo(newChannel.nsfw)}`);
    }
    lines.push(...describeOverwriteBlocks(oldChannel, newChannel));
    return lines;
  }

  /**
   * The fields of a role update that changed, as `[label, before, after]`
   * rows.
   */
  private describeRoleChanges(oldRole: Role, newRole: Role): Array<[string, string, string]> {
    const changes: Array<[string, string, string]> = [];
    if (oldRole.name !== newRole.name) {
      changes.push(["**➜** Name", oldRole.name, newRole.name]);
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push(["**➜** Color", oldRole.hexColor, newRole.hexColor]);
    }
    if (oldRole.hoist !== newRole.hoist) {
      changes.push(["**➜** Hoisted", yesNo(oldRole.hoist), yesNo(newRole.hoist)]);
    }
    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push(["**➜** Mentionable", yesNo(oldRole.mentionable), yesNo(newRole.mentionable)]);
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      // `missing` returns the bit names present in its argument but absent
      // from the receiver, so the old field's missing bits are what the new
      // one gained, and vice versa. `checkAdmin: false` keeps Administrator
      // a normal bit so it can be reported like any other.
      const granted = oldRole.permissions.missing(newRole.permissions.bitfield, false);
      const revoked = newRole.permissions.missing(oldRole.permissions.bitfield, false);
      if (granted.length > 0) {
        changes.push(["**➜** Permissions Granted", "None", formatPermissionNames(granted)]);
      }
      if (revoked.length > 0) {
        changes.push(["**➜** Permissions Revoked", formatPermissionNames(revoked), "None"]);
      }
    }
    return changes;
  }

  /**
   * The fields of a guild update that changed, as `[label, before, after]`
   * rows. Asset fields compare their hashes and render as links; a removed
   * asset shows "None".
   */
  private describeGuildChanges(oldGuild: Guild, newGuild: Guild): Array<[string, string, string]> {
    const changes: Array<[string, string, string]> = [];
    if (oldGuild.name !== newGuild.name) {
      changes.push(["**➜** Name", oldGuild.name, newGuild.name]);
    }
    if (oldGuild.icon !== newGuild.icon) {
      changes.push([
        "**➜** Icon",
        oldGuild.iconURL({ extension: "webp" }) ?? "None",
        newGuild.iconURL({ extension: "webp" }) ?? "None",
      ]);
    }
    if (oldGuild.banner !== newGuild.banner) {
      changes.push([
        "**➜** Banner",
        oldGuild.bannerURL({ extension: "webp" }) ?? "None",
        newGuild.bannerURL({ extension: "webp" }) ?? "None",
      ]);
    }
    if (oldGuild.splash !== newGuild.splash) {
      changes.push([
        "**➜** Invite Splash",
        oldGuild.splashURL({ extension: "webp" }) ?? "None",
        newGuild.splashURL({ extension: "webp" }) ?? "None",
      ]);
    }
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      changes.push([
        "**➜** Verification Level",
        VERIFICATION_LEVEL_NAMES[oldGuild.verificationLevel] ?? String(oldGuild.verificationLevel),
        VERIFICATION_LEVEL_NAMES[newGuild.verificationLevel] ?? String(newGuild.verificationLevel),
      ]);
    }
    return changes;
  }

  public handleEvent<T extends Event>(
    eventClass: new (...args: any[]) => T,
    logType: LogType,
    callback: (event: T, channel: TextChannel) => Promise<void>
  ): void {
    EventBus.register(
      this,
      eventClass,
      async event => {
        if (!(await loggingService.isEnabled(event.guild!, logType))) {
          return;
        }

        const channel = await this.getLogsChannel(event.guild!);
        if (!channel) {
          return;
        }

        await callback(event, channel);
      },
      { featureId: FeatureIds.Logging }
    );
  }
}

/**
 * Permission overwrite changes as embed lines, one block per target: the
 * verb that applies (added, removed, updated) and the resulting allowed and
 * denied permissions. A target with nothing to report produces no lines at
 * all, so unchanged overwrites never appear.
 */
function describeOverwriteBlocks(
  oldChannel: NonThreadGuildBasedChannel,
  newChannel: NonThreadGuildBasedChannel
): string[] {
  const lines: string[] = [];
  const oldOverwrites = oldChannel.permissionOverwrites.cache;
  const newOverwrites = newChannel.permissionOverwrites.cache;
  const ids = [...new Set([...oldOverwrites.keys(), ...newOverwrites.keys()])].sort((a, b) =>
    formatOverwriteTarget(newChannel.guild, a).localeCompare(formatOverwriteTarget(newChannel.guild, b))
  );
  for (const id of ids) {
    const before = oldOverwrites.get(id);
    const after = newOverwrites.get(id);
    const target = formatOverwriteTarget(newChannel.guild, id);
    if (!before && after) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(`**➜** Added permissions for ${target}`, ...overwriteBlock(after));
      continue;
    }
    if (before && !after) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(`**➜** Removed permissions for ${target}`, ...overwriteBlock(before));
      continue;
    }
    if (!before || !after) {
      continue;
    }
    const transitions = formatOverwriteTransitions(before, after);
    if (transitions.length === 0) {
      continue;
    }
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(
      `**➜** Updated permissions for ${target}`,
      "**✓** Allowed permissions",
      formatPermissionLabels(transitions.filter(([, , to]) => to === "allowed").map(([name]) => name)),
      "**✘** Denied permissions",
      formatPermissionLabels(transitions.filter(([, , to]) => to === "denied").map(([name]) => name))
    );
  }
  return lines;
}

function overwriteBlock(overwrite: PermissionOverwrites): string[] {
  return [
    "**✓** Allowed permissions",
    formatPermissionLabels(overwrite.allow.toArray()),
    "**✘** Denied permissions",
    formatPermissionLabels(overwrite.deny.toArray()),
  ];
}

function formatPermissionLabels(names: string[]): string {
  return names.length > 0 ? names.map(permissionLabel).sort().join(", ") : "none";
  return names.length > 0 ? names.map(permissionLabel).sort().join(", ") : "none";
}
