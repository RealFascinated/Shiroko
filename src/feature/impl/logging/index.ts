import type Event from "@/event/event";
import { EventBus } from "@/event/event-bus";
import AutoModActionExecutedEvent from "@/event/events/automod-action-executed.event";
import AutoModRuleCreatedEvent from "@/event/events/automod-rule-created.event";
import AutoModRuleDeletedEvent from "@/event/events/automod-rule-deleted.event";
import AutoModRuleUpdatedEvent from "@/event/events/automod-rule-updated.event";
import BotAddedEvent from "@/event/events/bot-added.event";
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
import MemberBoostUpdatedEvent from "@/event/events/member-boost-updated.event";
import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import MemberGuildLeaveEvent from "@/event/events/member-guild-leave.event";
import MemberNicknameUpdatedEvent from "@/event/events/member-nickname-updated.event";
import MemberRolesUpdatedEvent from "@/event/events/member-roles-updated.event";
import MemberTimeoutUpdatedEvent from "@/event/events/member-timeout-updated.event";
import RoleCreatedEvent from "@/event/events/role-created.event";
import RoleDeletedEvent from "@/event/events/role-deleted.event";
import RoleUpdatedEvent from "@/event/events/role-updated.event";
import ScheduledEventCreatedEvent from "@/event/events/scheduled-event-created.event";
import ScheduledEventDeletedEvent from "@/event/events/scheduled-event-deleted.event";
import ScheduledEventUpdatedEvent from "@/event/events/scheduled-event-updated.event";
import ScheduledEventUserAddedEvent from "@/event/events/scheduled-event-user-added.event";
import ScheduledEventUserRemovedEvent from "@/event/events/scheduled-event-user-removed.event";
import StageInstanceCreatedEvent from "@/event/events/stage-instance-created.event";
import StageInstanceDeletedEvent from "@/event/events/stage-instance-deleted.event";
import StageInstanceUpdatedEvent from "@/event/events/stage-instance-updated.event";
import StickerCreatedEvent from "@/event/events/sticker-created.event";
import StickerDeletedEvent from "@/event/events/sticker-deleted.event";
import StickerUpdatedEvent from "@/event/events/sticker-updated.event";
import ThreadCreatedEvent from "@/event/events/thread-created.event";
import ThreadDeletedEvent from "@/event/events/thread-deleted.event";
import ThreadUpdatedEvent from "@/event/events/thread-updated.event";
import UserAvatarUpdatedEvent from "@/event/events/user-avatar-updated.event";
import UserBannerUpdatedEvent from "@/event/events/user-banner-updated.event";
import UserDisplayNameUpdatedEvent from "@/event/events/user-display-name-updated.event";
import UserUsernameUpdatedEvent from "@/event/events/user-username-updated.event";
import VoiceStateChangedEvent from "@/event/events/voice-state-changed.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import { baseEmbed } from "@/lib/embed";
import { yesNo } from "@/lib/format";
import SettingsManager from "@/settings/index";
import { AuditLogEvent, ChannelType, EmbedBuilder, type Guild, type TextChannel } from "discord.js";
import { actorLines, moderatorLines } from "./lib/actor-log";
import { resolveAuditActor } from "./lib/audit-log";
import {
  automodExecutionLines,
  automodRuleDetailLines,
  describeAutomodRuleChanges,
  automodRuleLabel,
} from "./lib/automod-log";
import {
  channelDetails,
  channelLabel,
  channelOverwriteLines,
  channelTypeLabel,
  describeChannelChanges,
} from "./lib/channel-log";
import { describeEmojiChanges } from "./lib/emoji-log";
import { describeGuildChanges, PREMIUM_TIER_NAMES } from "./lib/guild-log";
import { LEAVE_VERBS, describeVoiceChange } from "./lib/member-log";
import { describeRoleChanges } from "./lib/role-log";
import {
  describeScheduledEventChanges,
  scheduledEventDetailLines,
  scheduledEventName,
} from "./lib/scheduled-event-log";
import { describeStageChanges, stageDetailLines } from "./lib/stage-log";
import { describeStickerChanges, stickerFormatLabel } from "./lib/sticker-log";
import { detailLine, timestamp } from "./lib/text";
import { describeThreadChanges, threadDetailLines } from "./lib/thread-log";
import { userLabel, assetLink } from "./lib/user-log";
import LoggingCommand from "./command/logging/logging.command";
import type { LogType } from "./log-type";
import { loggingSettings } from "./logging-settings";
import { loggingService } from "./logging.service";

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
            detailLine("Account Created", timestamp(event.member.user.createdAt)),
          ]).setThumbnail(event.member.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(BotAddedEvent, "bot_add", async (event, channel) => {
      const actor = await resolveAuditActor(event.member.guild, [AuditLogEvent.BotAdd], event.member.id);
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.member} was added to the server.`,
            "",
            `**➜** ID: \`${event.member.id}\``,
            `**➜** Username: \`${event.member.user.username}\``,
            ...actorLines(actor),
          ]).setThumbnail(event.member.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberGuildLeaveEvent, "member_leave", async (event, channel) => {
      // A ban fires both `GuildMemberRemove` and `GuildBanAdd`, and the ban
      // log already names the moderator, so only kicks and prunes are
      // resolved here.
      const actor = await resolveAuditActor(
        event.member.guild,
        [AuditLogEvent.MemberKick, AuditLogEvent.MemberPrune],
        event.member.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.member} ${(actor && LEAVE_VERBS[actor.action]) ?? "left the server."}`,
            "",
            `**➜** ID: \`${event.member.id}\``,
            `**➜** Username: \`${event.member.user.username}\``,
            ...actorLines(actor),
          ]).setThumbnail(event.member.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(VoiceStateChangedEvent, "voice", async (event, channel) => {
      const member = event.newState.member ?? event.oldState?.member ?? null;
      if (!member) {
        return;
      }
      const line = describeVoiceChange(member, event.oldState?.channelId ?? null, event.newState.channelId);
      if (!line) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            line,
            "",
            `**➜** ID: \`${member.id}\``,
            `**➜** Username: \`${member.user.username}\``,
          ]).setThumbnail(member.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(UserAvatarUpdatedEvent, "avatar_update", async (event, channel) => {
      const hadAvatar = event.oldUser.avatar !== null;
      const removed = hadAvatar && event.newUser.avatar === null;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            removed ? `${event.newUser} removed their avatar.` : `${event.newUser} changed their avatar.`,
            "",
            `**➜** ID: \`${event.newUser.id}\``,
            `**➜** Username: \`${event.newUser.username}\``,
            `**➜** Avatar: ${hadAvatar ? assetLink(event.beforeAssetUrl, "before") : "None"} → ${
              removed ? "Removed" : assetLink(event.afterAssetUrl, "after")
            }`,
          ]).setThumbnail(event.afterAssetUrl),
        ],
      });
    });
    this.handleEvent(UserBannerUpdatedEvent, "banner_update", async (event, channel) => {
      const hadBanner = event.oldUser.banner !== null;
      const removed = hadBanner && event.newUser.banner === null;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            removed ? `${event.newUser} removed their banner.` : `${event.newUser} changed their banner.`,
            "",
            `**➜** ID: \`${event.newUser.id}\``,
            `**➜** Username: \`${event.newUser.username}\``,
            `**➜** Banner: ${hadBanner ? assetLink(event.beforeAssetUrl, "before") : "None"} → ${
              removed ? "Removed" : assetLink(event.afterAssetUrl, "after")
            }`,
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
      const actor = await resolveAuditActor(
        event.newMember.guild,
        [AuditLogEvent.MemberRoleUpdate],
        event.newMember.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newMember} was given roles.`,
            "",
            `**➜** ID: \`${event.newMember.id}\``,
            `**➜** Roles: ${event.added.map(role => role.toString()).join(", ")}`,
            ...actorLines(actor),
          ]).setThumbnail(event.newMember.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberRolesUpdatedEvent, "member_roles", async (event, channel) => {
      if (event.removed.size === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.newMember.guild,
        [AuditLogEvent.MemberRoleUpdate],
        event.newMember.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newMember} had roles removed.`,
            "",
            `**➜** ID: \`${event.newMember.id}\``,
            `**➜** Roles: ${event.removed.map(role => role.toString()).join(", ")}`,
            ...actorLines(actor),
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

    this.handleEvent(MemberTimeoutUpdatedEvent, "member_timeout", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.newMember.guild,
        [AuditLogEvent.MemberUpdate],
        event.newMember.id
      );
      const until = event.timeoutUntil;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            until
              ? `${event.newMember} was timed out until ${timestamp(until)}.`
              : `${event.newMember} is no longer timed out.`,
            "",
            `**➜** ID: \`${event.newMember.id}\``,
            `**➜** Username: \`${event.newMember.user.username}\``,
            ...actorLines(actor),
          ]).setThumbnail(event.newMember.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberBoostUpdatedEvent, "boost", async (event, channel) => {
      const count = event.newMember.guild.premiumSubscriptionCount ?? 0;
      const tier = event.newMember.guild.premiumTier;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            event.boosted
              ? `${event.newMember} started boosting the server!`
              : `${event.newMember} stopped boosting the server.`,
            "",
            `**➜** ID: \`${event.newMember.id}\``,
            `**➜** Username: \`${event.newMember.user.username}\``,
            `**➜** Boosts: ${count}`,
            `**➜** Tier: ${PREMIUM_TIER_NAMES[tier] ?? String(tier)}`,
          ]).setThumbnail(event.newMember.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(GuildUpdatedEvent, "server_update", async (event, channel) => {
      const changes = describeGuildChanges(event.oldGuild, event.guildData);
      if (changes.length === 0) {
        return;
      }
      const embed = this.baseLogEmbed([`Server **${event.guildData.name}** was updated.`, "", ...changes]);
      await channel.send({ embeds: [embed] });
    });

    this.handleEvent(ChannelCreatedEvent, "channel", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.channel.guild,
        [AuditLogEvent.ChannelCreate],
        event.channel.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${channelLabel(event.channel)} was created.`,
            "",
            `**➜** Name: \`${event.channel.name}\``,
            `**➜** Type: \`${channelTypeLabel(event.channel.type)}\``,
            `**➜** ID: \`${event.channel.id}\``,
            ...channelDetails(event.channel),
            ...channelOverwriteLines(event.channel),
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(ChannelUpdatedEvent, "channel", async (event, channel) => {
      const changes = describeChannelChanges(event.oldChannel, event.newChannel);
      if (changes.length === 0) {
        return;
      }
      // Channel updates carry no attribution: `ChannelUpdate` and the three
      // overwrite actions share the channel as their target, so the newest
      // matching entry may belong to a different edit. A missing moderator
      // beats naming the wrong one.
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
      const actor = await resolveAuditActor(
        event.channel.guild,
        [AuditLogEvent.ChannelDelete],
        event.channel.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Channel \`${event.channel.name}\` was deleted.`,
            "",
            `**➜** Type: \`${channelTypeLabel(event.channel.type)}\``,
            `**➜** ID: \`${event.channel.id}\``,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(ThreadCreatedEvent, "thread", async (event, channel) => {
      // A thread's creator is its owner, which `threadDetailLines` already
      // names, so the audit entry would only repeat that same user.
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Thread <#${event.thread.id}> was created.`,
            "",
            ...threadDetailLines(event.thread),
          ]),
        ],
      });
    });

    this.handleEvent(ThreadUpdatedEvent, "thread", async (event, channel) => {
      const changes = describeThreadChanges(event.oldThread, event.newThread);
      if (changes.length === 0) {
        return;
      }
      // Unlike a channel update, a thread's audit target is the thread
      // itself, so the newest matching entry is this event's.
      const actor = await resolveAuditActor(
        event.newThread.guild,
        [AuditLogEvent.ThreadUpdate],
        event.newThread.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Thread <#${event.newThread.id}> was updated.`,
            "",
            `**➜** Name: \`${event.newThread.name}\``,
            ...changes,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(ThreadDeletedEvent, "thread", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.thread.guild,
        [AuditLogEvent.ThreadDelete],
        event.thread.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Thread \`${event.thread.name}\` was deleted.`,
            "",
            `**➜** Parent: ${event.thread.parentId ? `<#${event.thread.parentId}>` : "None"}`,
            `**➜** ID: \`${event.thread.id}\``,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(StageInstanceCreatedEvent, "stage", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.instance.guild!,
        [AuditLogEvent.StageInstanceCreate],
        event.instance.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Stage instance started in <#${event.instance.channelId}>.`,
            "",
            ...stageDetailLines(event.instance),
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(StageInstanceUpdatedEvent, "stage", async (event, channel) => {
      const changes = describeStageChanges(event.oldInstance, event.newInstance);
      if (changes.length === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.newInstance.guild!,
        [AuditLogEvent.StageInstanceUpdate],
        event.newInstance.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Stage instance in <#${event.newInstance.channelId}> was updated.`,
            "",
            ...changes,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(StageInstanceDeletedEvent, "stage", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.instance.guild!,
        [AuditLogEvent.StageInstanceDelete],
        event.instance.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Stage instance ended in <#${event.instance.channelId}>.`,
            "",
            `**➜** Topic: \`${event.instance.topic}\``,
            `**➜** ID: \`${event.instance.id}\``,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(ScheduledEventCreatedEvent, "scheduled_event", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.guild!,
        [AuditLogEvent.GuildScheduledEventCreate],
        event.scheduledEvent.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Scheduled event ${scheduledEventName(event.scheduledEvent)} was created.`,
            "",
            ...scheduledEventDetailLines(event.scheduledEvent),
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(ScheduledEventUpdatedEvent, "scheduled_event", async (event, channel) => {
      const changes = describeScheduledEventChanges(event.oldEvent, event.newEvent);
      if (changes.length === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.guild!,
        [AuditLogEvent.GuildScheduledEventUpdate],
        event.newEvent.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Scheduled event ${scheduledEventName(event.newEvent)} was updated.`,
            "",
            ...changes,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(ScheduledEventDeletedEvent, "scheduled_event", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.guild!,
        [AuditLogEvent.GuildScheduledEventDelete],
        event.scheduledEvent.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Scheduled event ${scheduledEventName(event.scheduledEvent)} was deleted.`,
            "",
            ...scheduledEventDetailLines(event.scheduledEvent),
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(ScheduledEventUserAddedEvent, "scheduled_event", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.user} is interested in ${scheduledEventName(event.scheduledEvent)}.`,
            "",
            `**➜** ID: \`${event.user.id}\``,
            `**➜** Interested: ${event.scheduledEvent.userCount ?? "Unknown"}`,
          ]).setThumbnail(event.user.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(ScheduledEventUserRemovedEvent, "scheduled_event", async (event, channel) => {
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.user} is no longer interested in ${scheduledEventName(event.scheduledEvent)}.`,
            "",
            `**➜** ID: \`${event.user.id}\``,
            `**➜** Interested: ${event.scheduledEvent.userCount ?? "Unknown"}`,
          ]).setThumbnail(event.user.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(AutoModRuleCreatedEvent, "automod", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.rule.guild,
        [AuditLogEvent.AutoModerationRuleCreate],
        event.rule.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `AutoMod rule \`${event.rule.name}\` was created.`,
            "",
            ...automodRuleDetailLines(event.rule),
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(AutoModRuleUpdatedEvent, "automod", async (event, channel) => {
      const changes = describeAutomodRuleChanges(event.oldRule, event.newRule);
      if (changes.length === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.newRule.guild,
        [AuditLogEvent.AutoModerationRuleUpdate],
        event.newRule.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `AutoMod rule \`${event.newRule.name}\` was updated.`,
            "",
            `**➜** ID: \`${event.newRule.id}\``,
            ...changes,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(AutoModRuleDeletedEvent, "automod", async (event, channel) => {
      const actor = await resolveAuditActor(
        event.rule.guild,
        [AuditLogEvent.AutoModerationRuleDelete],
        event.rule.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `AutoMod rule \`${event.rule.name}\` was deleted.`,
            "",
            `**➜** ID: \`${event.rule.id}\``,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(AutoModActionExecutedEvent, "automod", async (event, channel) => {
      const { execution } = event;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `AutoMod rule ${automodRuleLabel(execution.autoModerationRule, execution.ruleId)} took action.`,
            "",
            ...automodExecutionLines(execution),
          ]),
        ],
      });
    });

    this.handleEvent(RoleCreatedEvent, "role", async (event, channel) => {
      const actor = await resolveAuditActor(event.role.guild, [AuditLogEvent.RoleCreate], event.role.id);
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.role} was created.`,
            "",
            `**➜** ID: \`${event.role.id}\``,
            `**➜** Color: \`${event.role.hexColor}\``,
            `**➜** Hoisted: \`${yesNo(event.role.hoist)}\``,
            `**➜** Mentionable: \`${yesNo(event.role.mentionable)}\``,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(RoleUpdatedEvent, "role", async (event, channel) => {
      const changes = describeRoleChanges(event.oldRole, event.newRole);
      if (changes.length === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.newRole.guild,
        [AuditLogEvent.RoleUpdate],
        event.newRole.id
      );
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.newRole} was updated.`,
            "",
            `**➜** ID: \`${event.newRole.id}\``,
            ...changes,
            ...actorLines(actor),
          ]),
        ],
      });
    });

    this.handleEvent(RoleDeletedEvent, "role", async (event, channel) => {
      const actor = await resolveAuditActor(event.role.guild, [AuditLogEvent.RoleDelete], event.role.id);
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${event.role} was deleted.`,
            "",
            `**➜** ID: \`${event.role.id}\``,
            `**➜** Color: \`${event.role.hexColor}\``,
            ...actorLines(actor),
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
      const changes = describeEmojiChanges(event.oldEmoji, event.newEmoji);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Emoji ${event.newEmoji} was updated.`,
            "",
            `**➜** ID: \`${event.newEmoji.id}\``,
            ...changes,
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
            `**➜** Format: \`${stickerFormatLabel(event.sticker.format)}\``,
            `**➜** Tags: \`${event.sticker.tags ?? "None"}\``,
          ]).setImage(event.sticker.url),
        ],
      });
    });

    this.handleEvent(StickerUpdatedEvent, "sticker", async (event, channel) => {
      const changes = describeStickerChanges(event.oldSticker, event.newSticker);
      if (changes.length === 0) {
        return;
      }
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `Sticker **${event.newSticker.name}** was updated.`,
            "",
            `**➜** ID: \`${event.newSticker.id}\``,
            ...changes,
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
            `**➜** Format: \`${stickerFormatLabel(event.sticker.format)}\``,
          ]).setImage(event.sticker.url),
        ],
      });
    });

    this.handleEvent(MemberBannedEvent, "ban", async (event, channel) => {
      if (!event.banned) {
        return;
      }
      const { ban } = event;
      const actor = await resolveAuditActor(ban.guild, [AuditLogEvent.MemberBanAdd], ban.user.id);
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${ban.user} was banned.`,
            "",
            `**➜** ID: \`${ban.user.id}\``,
            `**➜** Username: \`${ban.user.username}\``,
            ...moderatorLines(actor),
            `**➜** Reason: \`${ban.reason ?? actor?.reason ?? "None"}\``,
          ]).setThumbnail(ban.user.displayAvatarURL({ size: 4096, extension: "webp" })),
        ],
      });
    });

    this.handleEvent(MemberBannedEvent, "ban", async (event, channel) => {
      if (event.banned) {
        return;
      }
      const { ban } = event;
      const actor = await resolveAuditActor(ban.guild, [AuditLogEvent.MemberBanRemove], ban.user.id);
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `${ban.user} was unbanned.`,
            "",
            `**➜** ID: \`${ban.user.id}\``,
            `**➜** Username: \`${ban.user.username}\``,
            ...actorLines(actor),
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
            detailLine("Expires", invite.expiresAt ? timestamp(invite.expiresAt) : "never"),
            ...(invite.inviter ? [`**➜** Created By: ${userLabel(invite.inviter)}`] : []),
          ]).setThumbnail(invite.inviter?.displayAvatarURL({ size: 4096, extension: "webp" }) ?? null),
        ],
      });
    });

    this.handleEvent(InviteDeletedEvent, "invite", async (event, channel) => {
      const actor = event.guild
        ? await resolveAuditActor(event.guild, [AuditLogEvent.InviteDelete], event.invite.code)
        : null;
      await channel.send({
        embeds: [
          this.baseLogEmbed([
            `**${event.guild!.name}** had an invite deleted.`,
            "",
            `**➜** Code: \`${event.invite.code}\``,
            ...actorLines(actor),
          ]),
        ],
      });
    });
  }

  /**
   * The guild's configured log channel, or `null` when unset, deleted, or
   * not a text channel. `fetch` rejects for a channel that no longer
   * exists, so the rejection folds into the same "unusable" result.
   */
  public async getLogsChannel(guild: Guild): Promise<TextChannel | null> {
    const channelId = await loggingService.getChannelId(guild);
    if (!channelId) {
      return null;
    }
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }
    return channel;
  }

  public baseLogEmbed(descriptionLines: string[] = []): EmbedBuilder {
    return baseEmbed().setDescription(descriptionLines.join("\n")).setTimestamp(new Date());
  }

  /**
   * Register one handler for `eventClass` behind the `logType` gate: when
   * the type is disabled, or the guild has no usable log channel, the
   * callback never runs.
   *
   * Never rejects. Handlers are dispatched from `void EventBus.post(...)`,
   * so a rejection here (a channel the bot cannot post to, for instance)
   * would surface as an `unhandledRejection`, which this process has no
   * handler for.
   */
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

        try {
          await callback(event, channel);
        } catch (error) {
          console.error(`Failed to post the ${logType} log for guild ${event.guild?.id}:`, error);
        }
      },
      { featureId: FeatureIds.Logging }
    );
  }
}
