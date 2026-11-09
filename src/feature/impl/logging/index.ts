import type Event from "@/event/event";
import { EventBus } from "@/event/event-bus";
import { GUILD_KIND_BY_ID } from "@/audit/kinds";
import ConfigChangeRecordedEvent from "@/event/events/config-change-recorded.event";
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
import MemberUnbannedEvent from "@/event/events/member-unbanned.event";
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
import {
  AuditLogEvent,
  ChannelType,
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type PartialUser,
  type ReadonlyCollection,
  type Role,
  type TextChannel,
  type User,
} from "discord.js";
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
  channelUpdateLines,
  describeChannelChanges,
} from "./lib/channel-log";
import { describeEmojiChanges } from "./lib/emoji-log";
import { describeGuildChanges, PREMIUM_TIER_NAMES } from "./lib/guild-log";
import { LEAVE_VERBS, describeVoiceChange, joinSourceLines } from "./lib/member-log";
import { describeRoleChanges } from "./lib/role-log";
import {
  type ScheduledEvent,
  describeScheduledEventChanges,
  scheduledEventDetailLines,
  scheduledEventName,
} from "./lib/scheduled-event-log";
import { describeStageChanges, stageDetailLines } from "./lib/stage-log";
import { describeStickerChanges, stickerFormatLabel } from "./lib/sticker-log";
import { beforeAfterLines, code, detailLine, timestamp } from "./lib/text";
import { describeThreadChanges, threadDetailLines } from "./lib/thread-log";
import { assetChangeLines, subjectAuthor, userLabel } from "./lib/user-log";
import LoggingCommand from "./command/logging/logging.command";
import type { LogType } from "./log-type";
import { loggingSettings } from "./logging-settings";
import { loggingService } from "./logging.service";

export default class LoggingFeature extends Feature {
  constructor() {
    super(FeatureIds.Logging, { name: "Logging", emoji: "📔" });

    SettingsManager.register(loggingSettings);
    this.registerCommand(new LoggingCommand());

    this.handleEvent(MemberGuildJoinEvent, "member_join", async event => {
      return this.baseLogEmbed(event.member.id, [
        `${event.member} joined the server.`,
        ...joinSourceLines(event.source),
        "",
        detailLine("Account Created", timestamp(event.member.user.createdAt)),
      ]).setAuthor(subjectAuthor(event.member));
    });

    this.handleEvent(BotAddedEvent, "bot_add", async event => {
      const actor = await resolveAuditActor(event.member.guild, [AuditLogEvent.BotAdd], event.member.id);
      return this.baseLogEmbed(event.member.id, [
        `${event.member} was added to the server.`,
        ...(actor ? ["", ...actorLines(actor)] : []),
      ]).setAuthor(subjectAuthor(event.member));
    });

    this.handleEvent(MemberGuildLeaveEvent, "member_leave", async event => {
      // A ban fires both `GuildMemberRemove` and `GuildBanAdd`, and the ban
      // log already names the moderator, so only kicks and prunes are
      // resolved here.
      const actor = await resolveAuditActor(
        event.member.guild,
        [AuditLogEvent.MemberKick, AuditLogEvent.MemberPrune],
        event.member.id
      );
      return this.baseLogEmbed(event.member.id, [
        `${event.member} ${(actor && LEAVE_VERBS[actor.action]) ?? "left the server."}`,
        ...(actor ? ["", ...actorLines(actor)] : []),
      ]).setAuthor(subjectAuthor(event.member));
    });

    this.handleEvent(VoiceStateChangedEvent, "voice", async event => {
      const member = event.newState.member ?? event.oldState?.member ?? null;
      if (!member) {
        return;
      }
      const line = describeVoiceChange(member, event.oldState?.channelId ?? null, event.newState.channelId);
      if (!line) {
        return;
      }
      return this.baseLogEmbed(member.id, [line]).setAuthor(subjectAuthor(member));
    });

    this.handleEvent(UserAvatarUpdatedEvent, "avatar_update", async event => {
      const hadAvatar = event.oldUser.avatar !== null;
      const removed = hadAvatar && event.newUser.avatar === null;
      return this.baseLogEmbed(
        event.newUser.id,
        assetChangeLines(
          event.newUser,
          "avatar",
          hadAvatar,
          removed,
          event.beforeAssetUrl,
          event.afterAssetUrl
        )
      )
        .setAuthor(subjectAuthor(event.newUser))
        .setThumbnail(event.afterAssetUrl);
    });
    this.handleEvent(UserBannerUpdatedEvent, "banner_update", async event => {
      const hadBanner = event.oldUser.banner !== null;
      const removed = hadBanner && event.newUser.banner === null;
      return this.baseLogEmbed(
        event.newUser.id,
        assetChangeLines(
          event.newUser,
          "banner",
          hadBanner,
          removed,
          event.beforeAssetUrl,
          event.afterAssetUrl
        )
      )
        .setAuthor(subjectAuthor(event.newUser))
        .setImage(event.afterAssetUrl);
    });
    this.handleEvent(UserUsernameUpdatedEvent, "username_update", async event => {
      return this.baseLogEmbed(
        event.newUser.id,
        beforeAfterLines(
          `${event.newUser} changed their username.`,
          event.oldUser.username ?? "Unknown",
          event.newUser.username ?? "Unknown"
        )
      ).setAuthor(subjectAuthor(event.newUser));
    });

    this.handleEvent(UserDisplayNameUpdatedEvent, "display_name_update", async event => {
      return this.baseLogEmbed(
        event.newUser.id,
        beforeAfterLines(
          `${event.newUser} changed their display name.`,
          event.oldUser.displayName,
          event.newUser.displayName
        )
      ).setAuthor(subjectAuthor(event.newUser));
    });

    this.handleEvent(MemberRolesUpdatedEvent, "member_roles", async event => {
      if (event.added.size === 0) {
        return;
      }
      return this.memberRolesEmbed(event.newMember, "was given roles.", event.added);
    });

    this.handleEvent(MemberRolesUpdatedEvent, "member_roles", async event => {
      if (event.removed.size === 0) {
        return;
      }
      return this.memberRolesEmbed(event.newMember, "had roles removed.", event.removed);
    });

    this.handleEvent(MemberNicknameUpdatedEvent, "nickname_update", async event => {
      return this.baseLogEmbed(
        event.newMember.id,
        beforeAfterLines(
          `${event.newMember} changed their nickname.`,
          event.oldMember.nickname ?? "None",
          event.newMember.nickname ?? "Removed"
        )
      ).setAuthor(subjectAuthor(event.newMember));
    });

    this.handleEvent(MemberTimeoutUpdatedEvent, "member_timeout", async event => {
      const actor = await resolveAuditActor(
        event.newMember.guild,
        [AuditLogEvent.MemberUpdate],
        event.newMember.id
      );
      const until = event.timeoutUntil;
      return this.baseLogEmbed(event.newMember.id, [
        until
          ? `${event.newMember} was timed out until ${timestamp(until)}.`
          : `${event.newMember} is no longer timed out.`,
        ...(actor ? ["", ...actorLines(actor)] : []),
      ]).setAuthor(subjectAuthor(event.newMember));
    });

    this.handleEvent(MemberBoostUpdatedEvent, "boost", async event => {
      const count = event.newMember.guild.premiumSubscriptionCount ?? 0;
      const tier = event.newMember.guild.premiumTier;
      return this.baseLogEmbed(event.newMember.id, [
        event.boosted
          ? `${event.newMember} started boosting the server!`
          : `${event.newMember} stopped boosting the server.`,
        "",
        detailLine("Boosts", String(count)),
        detailLine("Tier", PREMIUM_TIER_NAMES[tier] ?? String(tier)),
      ]).setAuthor(subjectAuthor(event.newMember));
    });

    this.handleEvent(GuildUpdatedEvent, "server_update", async event => {
      const changes = describeGuildChanges(event.oldGuild, event.guildData);
      if (changes.length === 0) {
        return;
      }
      const embed = this.baseLogEmbed(event.guildData.id, [
        `Server **${event.guildData.name}** was updated.`,
        "",
        ...changes,
      ]);
      return embed;
    });

    this.handleEvent(ConfigChangeRecordedEvent, "config_change", async event => {
      const { entry } = event;
      const actor = entry.actorId ? `<@${entry.actorId}>` : "The bot";
      return this.baseLogEmbed(String(entry.id), [
        `${actor} changed the configuration.`,
        "",
        (await GUILD_KIND_BY_ID[entry.kind]?.summary(entry)) ?? `\`${entry.subjectId}\` changed`,
      ]);
    });

    this.handleEvent(ChannelCreatedEvent, "channel", async event => {
      const actor = await resolveAuditActor(
        event.channel.guild,
        [AuditLogEvent.ChannelCreate],
        event.channel.id
      );
      return this.baseLogEmbed(event.channel.id, [
        `${channelLabel(event.channel)} was created.`,
        "",
        detailLine("Name", code(event.channel.name)),
        detailLine("Type", code(channelTypeLabel(event.channel.type))),
        ...channelDetails(event.channel),
        ...channelOverwriteLines(event.channel),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(ChannelUpdatedEvent, "channel", async event => {
      const lines = channelUpdateLines(
        event.newChannel,
        describeChannelChanges(event.oldChannel, event.newChannel)
      );
      if (lines.length === 0) {
        return;
      }
      // Channel updates carry no attribution: `ChannelUpdate` and the three
      // overwrite actions share the channel as their target, so the newest
      // matching entry may belong to a different edit. A missing moderator
      // beats naming the wrong one.
      return this.baseLogEmbed(event.newChannel.id, lines);
    });

    this.handleEvent(ChannelDeletedEvent, "channel", async event => {
      const actor = await resolveAuditActor(
        event.channel.guild,
        [AuditLogEvent.ChannelDelete],
        event.channel.id
      );
      return this.baseLogEmbed(event.channel.id, [
        `Channel \`${event.channel.name}\` was deleted.`,
        "",
        detailLine("Type", code(channelTypeLabel(event.channel.type))),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(ThreadCreatedEvent, "thread", async event => {
      // A thread's creator is its owner, which `threadDetailLines` already
      // names, so the audit entry would only repeat that same user.
      return this.baseLogEmbed(event.thread.id, [
        `Thread <#${event.thread.id}> was created.`,
        "",
        ...threadDetailLines(event.thread),
      ]);
    });

    this.handleEvent(ThreadUpdatedEvent, "thread", async event => {
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
      return this.baseLogEmbed(event.newThread.id, [
        `Thread <#${event.newThread.id}> was updated.`,
        "",
        detailLine("Name", code(event.newThread.name)),
        ...changes,
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(ThreadDeletedEvent, "thread", async event => {
      const actor = await resolveAuditActor(
        event.thread.guild,
        [AuditLogEvent.ThreadDelete],
        event.thread.id
      );
      return this.baseLogEmbed(event.thread.id, [
        `Thread \`${event.thread.name}\` was deleted.`,
        "",
        detailLine("Parent", event.thread.parentId ? `<#${event.thread.parentId}>` : "None"),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(StageInstanceCreatedEvent, "stage", async event => {
      const actor = await resolveAuditActor(
        event.instance.guild!,
        [AuditLogEvent.StageInstanceCreate],
        event.instance.id
      );
      return this.baseLogEmbed(event.instance.id, [
        `Stage instance started in <#${event.instance.channelId}>.`,
        "",
        ...stageDetailLines(event.instance),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(StageInstanceUpdatedEvent, "stage", async event => {
      const changes = describeStageChanges(event.oldInstance, event.newInstance);
      if (changes.length === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.newInstance.guild!,
        [AuditLogEvent.StageInstanceUpdate],
        event.newInstance.id
      );
      return this.baseLogEmbed(event.newInstance.id, [
        `Stage instance in <#${event.newInstance.channelId}> was updated.`,
        "",
        ...changes,
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(StageInstanceDeletedEvent, "stage", async event => {
      const actor = await resolveAuditActor(
        event.instance.guild!,
        [AuditLogEvent.StageInstanceDelete],
        event.instance.id
      );
      return this.baseLogEmbed(event.instance.id, [
        `Stage instance ended in <#${event.instance.channelId}>.`,
        "",
        detailLine("Topic", code(event.instance.topic)),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(ScheduledEventCreatedEvent, "scheduled_event", async event => {
      const actor = await resolveAuditActor(
        event.guild!,
        [AuditLogEvent.GuildScheduledEventCreate],
        event.scheduledEvent.id
      );
      return this.baseLogEmbed(event.scheduledEvent.id, [
        `Scheduled event ${scheduledEventName(event.scheduledEvent)} was created.`,
        "",
        ...scheduledEventDetailLines(event.scheduledEvent),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(ScheduledEventUpdatedEvent, "scheduled_event", async event => {
      const changes = describeScheduledEventChanges(event.oldEvent, event.newEvent);
      if (changes.length === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.guild!,
        [AuditLogEvent.GuildScheduledEventUpdate],
        event.newEvent.id
      );
      return this.baseLogEmbed(event.newEvent.id, [
        `Scheduled event ${scheduledEventName(event.newEvent)} was updated.`,
        "",
        ...changes,
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(ScheduledEventDeletedEvent, "scheduled_event", async event => {
      const actor = await resolveAuditActor(
        event.guild!,
        [AuditLogEvent.GuildScheduledEventDelete],
        event.scheduledEvent.id
      );
      return this.baseLogEmbed(event.scheduledEvent.id, [
        `Scheduled event ${scheduledEventName(event.scheduledEvent)} was deleted.`,
        "",
        ...scheduledEventDetailLines(event.scheduledEvent),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(ScheduledEventUserAddedEvent, "scheduled_event", async event => {
      return this.interestEmbed(event.user, event.scheduledEvent, "is interested in");
    });

    this.handleEvent(ScheduledEventUserRemovedEvent, "scheduled_event", async event => {
      return this.interestEmbed(event.user, event.scheduledEvent, "is no longer interested in");
    });

    this.handleEvent(AutoModRuleCreatedEvent, "automod", async event => {
      const actor = await resolveAuditActor(
        event.rule.guild,
        [AuditLogEvent.AutoModerationRuleCreate],
        event.rule.id
      );
      return this.baseLogEmbed(event.rule.id, [
        `AutoMod rule \`${event.rule.name}\` was created.`,
        "",
        ...automodRuleDetailLines(event.rule),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(AutoModRuleUpdatedEvent, "automod", async event => {
      const changes = describeAutomodRuleChanges(event.oldRule, event.newRule);
      if (changes.length === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.newRule.guild,
        [AuditLogEvent.AutoModerationRuleUpdate],
        event.newRule.id
      );
      return this.baseLogEmbed(event.newRule.id, [
        `AutoMod rule \`${event.newRule.name}\` was updated.`,
        "",
        ...changes,
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(AutoModRuleDeletedEvent, "automod", async event => {
      const actor = await resolveAuditActor(
        event.rule.guild,
        [AuditLogEvent.AutoModerationRuleDelete],
        event.rule.id
      );
      return this.baseLogEmbed(event.rule.id, [
        `AutoMod rule \`${event.rule.name}\` was deleted.`,
        "",
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(AutoModActionExecutedEvent, "automod", async event => {
      const { execution } = event;
      return this.baseLogEmbed(execution.ruleId, [
        `AutoMod rule ${automodRuleLabel(execution.autoModerationRule, execution.ruleId)} took action.`,
        "",
        ...automodExecutionLines(execution),
      ]);
    });

    this.handleEvent(RoleCreatedEvent, "role", async event => {
      const actor = await resolveAuditActor(event.role.guild, [AuditLogEvent.RoleCreate], event.role.id);
      return this.baseLogEmbed(event.role.id, [
        `${event.role} was created.`,
        "",
        detailLine("Color", code(event.role.hexColor)),
        detailLine("Hoisted", code(yesNo(event.role.hoist))),
        detailLine("Mentionable", code(yesNo(event.role.mentionable))),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(RoleUpdatedEvent, "role", async event => {
      const changes = describeRoleChanges(event.oldRole, event.newRole);
      if (changes.length === 0) {
        return;
      }
      const actor = await resolveAuditActor(
        event.newRole.guild,
        [AuditLogEvent.RoleUpdate],
        event.newRole.id
      );
      return this.baseLogEmbed(event.newRole.id, [
        `${event.newRole} was updated.`,
        "",
        ...changes,
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(RoleDeletedEvent, "role", async event => {
      const actor = await resolveAuditActor(event.role.guild, [AuditLogEvent.RoleDelete], event.role.id);
      return this.baseLogEmbed(event.role.id, [
        `${event.role} was deleted.`,
        "",
        detailLine("Color", code(event.role.hexColor)),
        ...actorLines(actor),
      ]);
    });

    this.handleEvent(EmojiCreatedEvent, "emoji", async event => {
      return this.baseLogEmbed(event.emoji.id, [
        `Emoji ${event.emoji} was created.`,
        "",
        detailLine("Name", code(event.emoji.name)),
        detailLine("Animated", code(yesNo(event.emoji.animated))),
      ]).setThumbnail(event.emoji.imageURL({ size: 4096 }));
    });

    this.handleEvent(EmojiUpdatedEvent, "emoji", async event => {
      const changes = describeEmojiChanges(event.oldEmoji, event.newEmoji);
      if (changes.length === 0) {
        return;
      }
      return this.baseLogEmbed(event.newEmoji.id, [
        `Emoji ${event.newEmoji} was updated.`,
        "",
        ...changes,
      ]).setThumbnail(event.newEmoji.imageURL({ size: 4096 }));
    });

    this.handleEvent(EmojiDeletedEvent, "emoji", async event => {
      return this.baseLogEmbed(event.emoji.id, [
        `Emoji ${event.emoji} was deleted.`,
        "",
        detailLine("Animated", code(yesNo(event.emoji.animated))),
      ]).setThumbnail(event.emoji.imageURL({ size: 4096 }));
    });

    this.handleEvent(StickerCreatedEvent, "sticker", async event => {
      return this.baseLogEmbed(event.sticker.id, [
        `Sticker **${event.sticker.name}** was created.`,
        "",
        detailLine("Description", code(event.sticker.description ?? "None")),
        detailLine("Format", code(stickerFormatLabel(event.sticker.format))),
        detailLine("Tags", code(event.sticker.tags ?? "None")),
      ]).setImage(event.sticker.url);
    });

    this.handleEvent(StickerUpdatedEvent, "sticker", async event => {
      const changes = describeStickerChanges(event.oldSticker, event.newSticker);
      if (changes.length === 0) {
        return;
      }
      return this.baseLogEmbed(event.newSticker.id, [
        `Sticker **${event.newSticker.name}** was updated.`,
        "",
        ...changes,
      ]).setImage(event.newSticker.url);
    });

    this.handleEvent(StickerDeletedEvent, "sticker", async event => {
      return this.baseLogEmbed(event.sticker.id, [
        `Sticker **${event.sticker.name}** was deleted.`,
        "",
        detailLine("Format", code(stickerFormatLabel(event.sticker.format))),
      ]).setImage(event.sticker.url);
    });

    this.handleEvent(MemberBannedEvent, "ban", async event => {
      const { ban } = event;
      const actor = await resolveAuditActor(ban.guild, [AuditLogEvent.MemberBanAdd], ban.user.id);
      return this.baseLogEmbed(ban.user.id, [
        `${ban.user} was banned.`,
        "",
        ...moderatorLines(actor),
        detailLine("Reason", code(ban.reason ?? actor?.reason ?? "None")),
      ]).setAuthor(subjectAuthor(ban.user));
    });

    this.handleEvent(MemberUnbannedEvent, "ban", async event => {
      const { ban } = event;
      const actor = await resolveAuditActor(ban.guild, [AuditLogEvent.MemberBanRemove], ban.user.id);
      return this.baseLogEmbed(ban.user.id, [
        `${ban.user} was unbanned.`,
        ...(actor ? ["", ...actorLines(actor)] : []),
      ]).setAuthor(subjectAuthor(ban.user));
    });

    this.handleEvent(InviteCreatedEvent, "invite", async event => {
      const { invite } = event;
      return this.baseLogEmbed(null, [
        `**${event.guild!.name}** had an invite created.`,
        "",
        detailLine("Code", code(invite.code)),
        detailLine("Channel", invite.channel ? `<#${invite.channel.id}>` : "`unknown`"),
        detailLine("Expires", invite.expiresAt ? timestamp(invite.expiresAt) : "never"),
        ...(invite.inviter ? [detailLine("Created By", userLabel(invite.inviter))] : []),
      ]).setThumbnail(invite.inviter?.displayAvatarURL({ size: 4096, extension: "webp" }) ?? null);
    });

    this.handleEvent(InviteDeletedEvent, "invite", async event => {
      const actor = event.guild
        ? await resolveAuditActor(event.guild, [AuditLogEvent.InviteDelete], event.invite.code)
        : null;
      return this.baseLogEmbed(null, [
        `**${event.guild!.name}** had an invite deleted.`,
        "",
        detailLine("Code", code(event.invite.code)),
        ...actorLines(actor),
      ]);
    });
  }

  private async memberRolesEmbed(
    member: GuildMember,
    headline: string,
    roles: ReadonlyCollection<string, Role>
  ): Promise<EmbedBuilder> {
    const actor = await resolveAuditActor(member.guild, [AuditLogEvent.MemberRoleUpdate], member.id);
    return this.baseLogEmbed(member.id, [
      `${member} ${headline}`,
      "",
      detailLine("Roles", roles.map(role => role.toString()).join(", ")),
      ...actorLines(actor),
    ]).setAuthor(subjectAuthor(member));
  }

  private interestEmbed(
    user: User | PartialUser,
    scheduledEvent: ScheduledEvent,
    verb: string
  ): EmbedBuilder {
    return this.baseLogEmbed(user.id, [
      `${user} ${verb} ${scheduledEventName(scheduledEvent)}.`,
      "",
      detailLine("Interested", String(scheduledEvent.userCount ?? "Unknown")),
    ]).setAuthor(subjectAuthor(user));
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

  /**
   * A log card. The subject's id rides in the footer instead of a detail
   * line, leaving the body to what actually happened. Pass `null` for a
   * subject with no id of its own, such as an invite.
   */
  public baseLogEmbed(id: string | null, descriptionLines: string[] = []): EmbedBuilder {
    const embed = baseEmbed().setDescription(descriptionLines.join("\n")).setTimestamp(new Date());
    return id === null ? embed : embed.setFooter({ text: `ID: ${id}` });
  }

  /**
   * Register one handler for `eventClass` behind the `logType` gate: when
   * the type is disabled, or the guild has no usable log channel, the
   * callback never runs. The callback returns the card to post, or nothing
   * to skip it.
   *
   * Never rejects. Handlers are dispatched from `void EventBus.post(...)`,
   * so a rejection here (a channel the bot cannot post to, for instance)
   * would surface as an `unhandledRejection`, which this process has no
   * handler for.
   */
  public handleEvent<T extends Event>(
    eventClass: new (...args: any[]) => T,
    logType: LogType,
    callback: (event: T) => Promise<EmbedBuilder | void>
  ): void {
    EventBus.register(
      this,
      eventClass,
      async event => {
        const guild = event.guild;
        if (!guild) {
          return;
        }
        if (!(await loggingService.isEnabled(guild, logType))) {
          return;
        }

        const channel = await this.getLogsChannel(guild);
        if (!channel) {
          return;
        }

        try {
          const embed = await callback(event);
          if (embed) {
            await channel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error(`Failed to post the ${logType} log for guild ${event.guild?.id}:`, error);
        }
      },
      { featureId: FeatureIds.Logging }
    );
  }
}
