import type Event from "@/event/event";
import { EventBus } from "@/event/event-bus";
import InviteCreatedEvent from "@/event/events/invite-created.event";
import InviteDeletedEvent from "@/event/events/invite-deleted.event";
import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import MemberGuildLeaveEvent from "@/event/events/member-guild-leave.event";
import MemberRolesUpdatedEvent from "@/event/events/member-roles-updated.event";
import UserAvatarUpdatedEvent from "@/event/events/user-avatar-updated.event";
import UserDisplayNameUpdatedEvent from "@/event/events/user-display-name-updated.event";
import UserUsernameUpdatedEvent from "@/event/events/user-username-updated.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import { baseEmbed } from "@/lib/embed";
import { ChannelType, EmbedBuilder, type Guild, type TextChannel } from "discord.js";
import LoggingCommand from "./command/logging/logging.command";
import type { LogType } from "./log-type";
import { loggingService } from "./logging.service";

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
