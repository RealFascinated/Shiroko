import type Event from "@/event/event";
import { EventBus } from "@/event/event-bus";
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
import UserDisplayNameUpdatedEvent from "@/event/events/user-display-name-updated.event";
import UserUsernameUpdatedEvent from "@/event/events/user-username-updated.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import { baseEmbed } from "@/lib/embed";
import { yesNo } from "@/lib/format";
import {
  ChannelType,
  EmbedBuilder,
  GuildVerificationLevel,
  StickerFormatType,
  type Guild,
  type GuildEmoji,
  type Role,
  type Sticker,
  type TextChannel,
} from "discord.js";
import LoggingCommand from "./command/logging/logging.command";
import type { LogType } from "./log-type";
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

/** Render role ids as mentions, or "None" when the list is empty. */
function formatRoleIds(roleIds: string[]): string {
  return roleIds.length > 0 ? roleIds.map(id => `<@&${id}>`).join(", ") : "None";
}

/**
 * Render permission bit names as friendly labels, splitting the camelCase
 * Discord uses (`ManageGuild` becomes `Manage Guild`).
 */
function formatPermissionNames(names: string[]): string {
  return names.map(name => name.replace(/([a-z])([A-Z])/g, "$1 $2")).join(", ");
}

export default class LoggingFeature extends Feature {
  constructor() {
    super(FeatureIds.Logging, { name: "Logging", emoji: "📔" });

    this.registerCommand(new LoggingCommand());

    this.handleEvent(MemberGuildJoinEvent, "member_join", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.member.user.tag}** joined the server.`,
            "",
            `**➜** ID: ${event.member.id}`,
            `**➜** Username: ${event.member.user.username}`,
            `**➜** Account Created: <t:${Math.floor(event.member.user.createdAt.getTime() / 1000)}>`,
          ]).setThumbnail(event.member.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberGuildLeaveEvent, "member_leave", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.member.user.tag}** left the server.`,
            "",
            `**➜** ID: ${event.member.id}`,
            `**➜** Username: ${event.member.user.username}`,
          ]).setThumbnail(event.member.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(UserAvatarUpdatedEvent, "avatar_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.newUser.tag}** changed their avatar.`,
            "",
            `**➜** ID: ${event.newUser.id}`,
            `**➜** Username: ${event.newUser.username}`,
          ]).setThumbnail(event.newUser.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(UserUsernameUpdatedEvent, "username_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.newUser.tag}** changed their username.`,
            "",
            `**➜** ID: ${event.newUser.id}`,
            `**➜** Before: ${event.oldUser.username}`,
            `**➜** After: ${event.newUser.username}`,
          ]).setThumbnail(event.newUser.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(UserDisplayNameUpdatedEvent, "display_name_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.newUser.tag}** changed their display name.`,
            "",
            `**➜** ID: ${event.newUser.id}`,
            `**➜** Before: ${event.oldUser.displayName}`,
            `**➜** After: ${event.newUser.displayName}`,
          ]).setThumbnail(event.newUser.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberRolesUpdatedEvent, "role_add", async (event, channel) => {
      if (event.added.size === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.newMember.user.tag}** was given roles.`,
            "",
            `**➜** ID: ${event.newMember.id}`,
            `**➜** Roles: ${event.added.map(role => role.toString()).join(", ")}`,
          ]).setThumbnail(event.newMember.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberRolesUpdatedEvent, "role_remove", async (event, channel) => {
      if (event.removed.size === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.newMember.user.tag}** had roles removed.`,
            "",
            `**➜** ID: ${event.newMember.id}`,
            `**➜** Roles: ${event.removed.map(role => role.toString()).join(", ")}`,
          ]).setThumbnail(event.newMember.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberNicknameUpdatedEvent, "nickname_update", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.newMember.user.tag}** changed their nickname.`,
            "",
            `**➜** ID: ${event.newMember.id}`,
            `**➜** Before: ${event.oldMember.nickname ?? "None"}`,
            `**➜** After: ${event.newMember.nickname ?? "Removed"}`,
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
        `**${event.guildData.name}** was updated.`,
        "",
        ...changes.map(([label, before, after]) => `**➜** ${label}: ${before} → ${after}`),
      ]);
      await channel.send({ embeds: [embed] });
    });

    this.handleEvent(RoleCreatedEvent, "role_create", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Role **${event.role.name}** was created.`,
            "",
            `**➜** Mention: ${event.role.toString()}`,
            `**➜** ID: ${event.role.id}`,
            `**➜** Color: ${event.role.hexColor}`,
            `**➜** Hoisted: ${yesNo(event.role.hoist)}`,
            `**➜** Mentionable: ${yesNo(event.role.mentionable)}`,
          ]),
        ],
      });
    });

    this.handleEvent(RoleUpdatedEvent, "role_update", async (event, channel) => {
      const changes = this.describeRoleChanges(event.oldRole, event.newRole);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Role **${event.newRole.name}** was updated.`,
            "",
            `**➜** ID: ${event.newRole.id}`,
            ...changes.map(([label, before, after]) => `**➜** ${label}: ${before} → ${after}`),
          ]),
        ],
      });
    });

    this.handleEvent(RoleDeletedEvent, "role_delete", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Role **${event.role.name}** was deleted.`,
            "",
            `**➜** ID: ${event.role.id}`,
            `**➜** Color: ${event.role.hexColor}`,
          ]),
        ],
      });
    });

    this.handleEvent(EmojiCreatedEvent, "emoji_create", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Emoji ${event.emoji} was created.`,
            "",
            `**➜** Name: ${event.emoji.name}`,
            `**➜** ID: ${event.emoji.id}`,
            `**➜** Animated: ${yesNo(event.emoji.animated)}`,
          ]).setThumbnail(event.emoji.imageURL({ size: 4096 })),
        ],
      });
    });

    this.handleEvent(EmojiUpdatedEvent, "emoji_update", async (event, channel) => {
      const changes = this.describeEmojiChanges(event.oldEmoji, event.newEmoji);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Emoji ${event.newEmoji} was updated.`,
            "",
            `**➜** ID: ${event.newEmoji.id}`,
            ...changes.map(([label, before, after]) => `**➜** ${label}: ${before} → ${after}`),
          ]).setThumbnail(event.newEmoji.imageURL({ size: 4096 })),
        ],
      });
    });

    this.handleEvent(EmojiDeletedEvent, "emoji_delete", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Emoji **${event.emoji.name}** was deleted.`,
            "",
            `**➜** ID: ${event.emoji.id}`,
            `**➜** Animated: ${yesNo(event.emoji.animated)}`,
          ]).setThumbnail(event.emoji.imageURL({ size: 4096 })),
        ],
      });
    });

    this.handleEvent(StickerCreatedEvent, "sticker_create", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Sticker **${event.sticker.name}** was created.`,
            "",
            `**➜** ID: ${event.sticker.id}`,
            `**➜** Description: ${event.sticker.description ?? "None"}`,
            `**➜** Format: ${STICKER_FORMAT_NAMES[event.sticker.format] ?? "Unknown"}`,
            `**➜** Tags: ${event.sticker.tags ?? "None"}`,
          ]).setImage(event.sticker.url),
        ],
      });
    });

    this.handleEvent(StickerUpdatedEvent, "sticker_update", async (event, channel) => {
      const changes = this.describeStickerChanges(event.oldSticker, event.newSticker);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Sticker **${event.newSticker.name}** was updated.`,
            "",
            `**➜** ID: ${event.newSticker.id}`,
            ...changes.map(([label, before, after]) => `**➜** ${label}: ${before} → ${after}`),
          ]).setImage(event.newSticker.url),
        ],
      });
    });

    this.handleEvent(StickerDeletedEvent, "sticker_delete", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Sticker **${event.sticker.name}** was deleted.`,
            "",
            `**➜** ID: ${event.sticker.id}`,
            `**➜** Format: ${STICKER_FORMAT_NAMES[event.sticker.format] ?? "Unknown"}`,
          ]).setImage(event.sticker.url),
        ],
      });
    });

    this.handleEvent(MemberBannedEvent, "ban_add", async (event, channel) => {
      if (!event.banned) {
        return;
      }
      const { ban } = event;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${ban.user.tag}** was banned.`,
            "",
            `**➜** ID: ${ban.user.id}`,
            `**➜** Username: ${ban.user.username}`,
            `**➜** Reason: ${ban.reason ?? "None"}`,
          ]).setThumbnail(ban.user.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberBannedEvent, "ban_remove", async (event, channel) => {
      if (event.banned) {
        return;
      }
      const { ban } = event;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${ban.user.tag}** was unbanned.`,
            "",
            `**➜** ID: ${ban.user.id}`,
            `**➜** Username: ${ban.user.username}`,
          ]).setThumbnail(ban.user.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(InviteCreatedEvent, "invite_create", async (event, channel) => {
      const { invite } = event;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.guild!.name}** had an invite created.`,
            "",
            `**➜** Code: \`${invite.code}\``,
            `**➜** Channel: ${invite.channel ? `<#${invite.channel.id}>` : "unknown"}`,
            `**➜** Inviter: ${invite.inviter ? `${invite.inviter.tag} (${invite.inviter.id})` : "unknown"}`,
            `**➜** Uses: ${invite.uses ?? 0}`,
            `**➜** Expires: ${invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}>` : "never"}`,
          ]).setThumbnail(invite.inviter?.displayAvatarURL({ size: 4096, extension: "webp" }) ?? null),
        ],
      });
    });

    this.handleEvent(InviteDeletedEvent, "invite_delete", async (event, channel) => {
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
      changes.push(["Name", oldSticker.name, newSticker.name]);
    }
    if (oldSticker.description !== newSticker.description) {
      changes.push(["Description", oldSticker.description ?? "None", newSticker.description ?? "None"]);
    }
    if (oldSticker.tags !== newSticker.tags) {
      changes.push(["Tags", oldSticker.tags ?? "None", newSticker.tags ?? "None"]);
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
      changes.push(["Name", oldEmoji.name ?? "None", newEmoji.name ?? "None"]);
    }
    if (oldEmoji.animated !== newEmoji.animated) {
      changes.push(["Animated", yesNo(oldEmoji.animated), yesNo(newEmoji.animated)]);
    }
    const oldRoles = formatRoleIds([...oldEmoji.roles.cache.keys()]);
    const newRoles = formatRoleIds([...newEmoji.roles.cache.keys()]);
    if (oldRoles !== newRoles) {
      changes.push(["Role Restriction", oldRoles, newRoles]);
    }
    return changes;
  }

  /**
   * The fields of a role update that changed, as `[label, before, after]`
   * rows.
   */
  private describeRoleChanges(oldRole: Role, newRole: Role): Array<[string, string, string]> {
    const changes: Array<[string, string, string]> = [];
    if (oldRole.name !== newRole.name) {
      changes.push(["Name", oldRole.name, newRole.name]);
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push(["Color", oldRole.hexColor, newRole.hexColor]);
    }
    if (oldRole.hoist !== newRole.hoist) {
      changes.push(["Hoisted", yesNo(oldRole.hoist), yesNo(newRole.hoist)]);
    }
    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push(["Mentionable", yesNo(oldRole.mentionable), yesNo(newRole.mentionable)]);
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      // `missing` returns the bit names present in its argument but absent
      // from the receiver, so the old field's missing bits are what the new
      // one gained, and vice versa. `checkAdmin: false` keeps Administrator
      // a normal bit so it can be reported like any other.
      const granted = oldRole.permissions.missing(newRole.permissions.bitfield, false);
      const revoked = newRole.permissions.missing(oldRole.permissions.bitfield, false);
      if (granted.length > 0) {
        changes.push(["Permissions Granted", "None", formatPermissionNames(granted)]);
      }
      if (revoked.length > 0) {
        changes.push(["Permissions Revoked", formatPermissionNames(revoked), "None"]);
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
      changes.push(["Name", oldGuild.name, newGuild.name]);
    }
    if (oldGuild.icon !== newGuild.icon) {
      changes.push([
        "Icon",
        oldGuild.iconURL({ extension: "webp" }) ?? "None",
        newGuild.iconURL({ extension: "webp" }) ?? "None",
      ]);
    }
    if (oldGuild.banner !== newGuild.banner) {
      changes.push([
        "Banner",
        oldGuild.bannerURL({ extension: "webp" }) ?? "None",
        newGuild.bannerURL({ extension: "webp" }) ?? "None",
      ]);
    }
    if (oldGuild.splash !== newGuild.splash) {
      changes.push([
        "Invite Splash",
        oldGuild.splashURL({ extension: "webp" }) ?? "None",
        newGuild.splashURL({ extension: "webp" }) ?? "None",
      ]);
    }
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      changes.push([
        "Verification Level",
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
