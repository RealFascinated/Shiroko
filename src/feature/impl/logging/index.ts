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
import { formatCount, yesNo } from "@/lib/format";
import SettingsManager from "@/settings/index";
import {
  AuditLogEvent,
  ChannelType,
  type Guild,
  type PartialUser,
  type TextChannel,
  type User,
} from "discord.js";
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
  channelUpdateCard,
  describeChannelChanges,
} from "./lib/channel-log";
import { describeEmojiChanges } from "./lib/emoji-log";
import { describeGuildChanges, PREMIUM_TIER_NAMES } from "./lib/guild-log";
import { LogTone, buildLogCard, idFooter, type LogCard } from "./lib/log-card";
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
import {
  beforeAfterLines,
  channelMention,
  code,
  detailLine,
  mentionList,
  timestamp,
  timestampWithAge,
} from "./lib/text";
import { describeThreadChanges, threadDetailLines } from "./lib/thread-log";
import { assetChangeCard } from "./lib/user-log";
import type { LogType } from "./log-type";
import { loggingSettings } from "./logging-settings";
import { loggingService } from "./logging.service";

export default class LoggingFeature extends Feature {
  constructor() {
    super(FeatureIds.Logging, { name: "Logging", emoji: "📔" });

    SettingsManager.register(loggingSettings);

    this.handleEvent(MemberGuildJoinEvent, "member_join", async event => ({
      tone: LogTone.Positive,
      headline: `${event.member} joined the server.`,
      details: [
        ...joinSourceLines(event.source),
        detailLine("Account Created", timestampWithAge(event.member.user.createdAt)),
      ],
      subject: event.member,
      footer: idFooter("User", event.member.id),
    }));

    this.handleEvent(BotAddedEvent, "bot_add", async event => ({
      tone: LogTone.Positive,
      headline: `${event.member} was added to the server.`,
      actor: await resolveAuditActor(event.member.guild, [AuditLogEvent.BotAdd], event.member.id),
      subject: event.member,
      footer: idFooter("Bot", event.member.id),
    }));

    this.handleEvent(MemberGuildLeaveEvent, "member_leave", async event => {
      // A ban fires both `GuildMemberRemove` and `GuildBanAdd`, and the ban
      // log already names the moderator, so only kicks and prunes are
      // resolved here.
      const actor = await resolveAuditActor(
        event.member.guild,
        [AuditLogEvent.MemberKick, AuditLogEvent.MemberPrune],
        event.member.id
      );
      return {
        tone: LogTone.Negative,
        headline: `${event.member} ${(actor && LEAVE_VERBS[actor.action]) ?? "left the server."}`,
        actor,
        subject: event.member,
        footer: idFooter("User", event.member.id),
      };
    });

    this.handleEvent(VoiceStateChangedEvent, "voice", async event => {
      const member = event.newState.member ?? event.oldState?.member ?? null;
      if (!member) {
        return;
      }
      const change = describeVoiceChange(member, event.oldState?.channelId ?? null, event.newState.channelId);
      if (!change) {
        return;
      }
      return { ...change, subject: member, footer: idFooter("User", member.id) };
    });

    this.handleEvent(UserAvatarUpdatedEvent, "avatar_update", async event => {
      const hadAvatar = event.oldUser.avatar !== null;
      const removed = hadAvatar && event.newUser.avatar === null;
      return {
        ...assetChangeCard(
          event.newUser,
          "avatar",
          hadAvatar,
          removed,
          event.beforeAssetUrl,
          event.afterAssetUrl
        ),
        thumbnail: event.afterAssetUrl,
      };
    });

    this.handleEvent(UserBannerUpdatedEvent, "banner_update", async event => {
      const hadBanner = event.oldUser.banner !== null;
      const removed = hadBanner && event.newUser.banner === null;
      return {
        ...assetChangeCard(
          event.newUser,
          "banner",
          hadBanner,
          removed,
          event.beforeAssetUrl,
          event.afterAssetUrl
        ),
        image: event.afterAssetUrl,
      };
    });

    this.handleEvent(UserUsernameUpdatedEvent, "username_update", async event => ({
      tone: LogTone.Change,
      headline: `${event.newUser} changed their username.`,
      details: beforeAfterLines(event.oldUser.username, event.newUser.username),
      subject: event.newUser,
      footer: idFooter("User", event.newUser.id),
    }));

    this.handleEvent(UserDisplayNameUpdatedEvent, "display_name_update", async event => ({
      tone: LogTone.Change,
      headline: `${event.newUser} changed their display name.`,
      details: beforeAfterLines(event.oldUser.displayName, event.newUser.displayName),
      subject: event.newUser,
      footer: idFooter("User", event.newUser.id),
    }));

    this.handleEvent(MemberRolesUpdatedEvent, "member_roles", async event => {
      const { added, removed, newMember } = event;
      if (added.size === 0 && removed.size === 0) {
        return;
      }
      const details: string[] = [];
      if (added.size > 0) {
        details.push(detailLine("Added", mentionList([...added.keys()], "@&")));
      }
      if (removed.size > 0) {
        details.push(detailLine("Removed", mentionList([...removed.keys()], "@&")));
      }
      return {
        tone: removed.size === 0 ? LogTone.Positive : added.size === 0 ? LogTone.Negative : LogTone.Change,
        headline: `${newMember}'s roles were updated.`,
        details,
        actor: await resolveAuditActor(newMember.guild, [AuditLogEvent.MemberRoleUpdate], newMember.id),
        subject: newMember,
        footer: idFooter("User", newMember.id),
      };
    });

    this.handleEvent(MemberNicknameUpdatedEvent, "nickname_update", async event => ({
      tone: LogTone.Change,
      headline: `${event.newMember} changed their nickname.`,
      details: beforeAfterLines(event.oldMember.nickname, event.newMember.nickname),
      subject: event.newMember,
      footer: idFooter("User", event.newMember.id),
    }));

    this.handleEvent(MemberTimeoutUpdatedEvent, "member_timeout", async event => {
      const until = event.timeoutUntil;
      return {
        tone: until ? LogTone.Negative : LogTone.Positive,
        headline: until
          ? `${event.newMember} was timed out until ${timestamp(until)}.`
          : `${event.newMember} is no longer timed out.`,
        actor: await resolveAuditActor(
          event.newMember.guild,
          [AuditLogEvent.MemberUpdate],
          event.newMember.id
        ),
        subject: event.newMember,
        footer: idFooter("User", event.newMember.id),
      };
    });

    this.handleEvent(MemberBoostUpdatedEvent, "boost", async event => {
      const { guild } = event.newMember;
      return {
        tone: event.boosted ? LogTone.Positive : LogTone.Negative,
        headline: event.boosted
          ? `${event.newMember} started boosting the server!`
          : `${event.newMember} stopped boosting the server.`,
        details: [
          detailLine("Boosts", formatCount(guild.premiumSubscriptionCount ?? 0)),
          detailLine("Tier", PREMIUM_TIER_NAMES[guild.premiumTier] ?? String(guild.premiumTier)),
        ],
        subject: event.newMember,
        footer: idFooter("User", event.newMember.id),
      };
    });

    this.handleEvent(GuildUpdatedEvent, "server_update", async event => {
      const changes = describeGuildChanges(event.oldGuild, event.guildData);
      if (changes.length === 0) {
        return;
      }
      return {
        tone: LogTone.Change,
        headline: "The server was updated.",
        details: changes,
        footer: idFooter("Server", event.guildData.id),
      };
    });

    this.handleEvent(ConfigChangeRecordedEvent, "config_change", async event => {
      const { entry } = event;
      const actor = entry.actorId
        ? await event.guildData.client.users.fetch(entry.actorId).catch(() => null)
        : null;
      return {
        tone: LogTone.Change,
        headline: `${entry.actorId ? `<@${entry.actorId}>` : "The bot"} changed the configuration.`,
        details: [(await GUILD_KIND_BY_ID[entry.kind]?.summary(entry)) ?? `${code(entry.subjectId)} changed`],
        subject: actor,
        footer: `Entry #${entry.id}`,
      };
    });

    this.handleEvent(ChannelCreatedEvent, "channel", async event => ({
      tone: LogTone.Positive,
      headline: `${channelLabel(event.channel)} was created.`,
      details: [
        detailLine("Name", code(event.channel.name)),
        detailLine("Type", channelTypeLabel(event.channel.type)),
        ...channelDetails(event.channel),
        ...channelOverwriteLines(event.channel),
      ],
      actor: await resolveAuditActor(event.channel.guild, [AuditLogEvent.ChannelCreate], event.channel.id),
      footer: idFooter("Channel", event.channel.id),
    }));

    this.handleEvent(ChannelUpdatedEvent, "channel", async event => {
      const card = channelUpdateCard(
        event.newChannel,
        describeChannelChanges(event.oldChannel, event.newChannel)
      );
      if (!card) {
        return;
      }
      // Channel updates carry no attribution: `ChannelUpdate` and the three
      // overwrite actions share the channel as their target, so the newest
      // matching entry may belong to a different edit. A missing moderator
      // beats naming the wrong one.
      return { tone: LogTone.Change, ...card, footer: idFooter("Channel", event.newChannel.id) };
    });

    this.handleEvent(ChannelDeletedEvent, "channel", async event => ({
      tone: LogTone.Negative,
      headline: `Channel ${code(event.channel.name)} was deleted.`,
      details: [detailLine("Type", channelTypeLabel(event.channel.type))],
      actor: await resolveAuditActor(event.channel.guild, [AuditLogEvent.ChannelDelete], event.channel.id),
      footer: idFooter("Channel", event.channel.id),
    }));

    // A thread's creator is its owner, which `threadDetailLines` already
    // names, so the audit entry would only repeat that same user.
    this.handleEvent(ThreadCreatedEvent, "thread", async event => ({
      tone: LogTone.Positive,
      headline: `Thread ${channelMention(event.thread.id)} was created.`,
      details: threadDetailLines(event.thread),
      footer: idFooter("Thread", event.thread.id),
    }));

    this.handleEvent(ThreadUpdatedEvent, "thread", async event => {
      const changes = describeThreadChanges(event.oldThread, event.newThread);
      if (changes.length === 0) {
        return;
      }
      // Unlike a channel update, a thread's audit target is the thread
      // itself, so the newest matching entry is this event's.
      return {
        tone: LogTone.Change,
        headline: `Thread ${channelMention(event.newThread.id)} was updated.`,
        details: changes,
        actor: await resolveAuditActor(
          event.newThread.guild,
          [AuditLogEvent.ThreadUpdate],
          event.newThread.id
        ),
        footer: idFooter("Thread", event.newThread.id),
      };
    });

    this.handleEvent(ThreadDeletedEvent, "thread", async event => ({
      tone: LogTone.Negative,
      headline: `Thread ${code(event.thread.name)} was deleted.`,
      details: [detailLine("Parent", channelMention(event.thread.parentId))],
      actor: await resolveAuditActor(event.thread.guild, [AuditLogEvent.ThreadDelete], event.thread.id),
      footer: idFooter("Thread", event.thread.id),
    }));

    this.handleEvent(StageInstanceCreatedEvent, "stage", async event => ({
      tone: LogTone.Positive,
      headline: `Stage instance started in ${channelMention(event.instance.channelId)}.`,
      details: stageDetailLines(event.instance),
      actor: await resolveAuditActor(
        event.instance.guild!,
        [AuditLogEvent.StageInstanceCreate],
        event.instance.id
      ),
      footer: idFooter("Stage", event.instance.id),
    }));

    this.handleEvent(StageInstanceUpdatedEvent, "stage", async event => {
      const changes = describeStageChanges(event.oldInstance, event.newInstance);
      if (changes.length === 0) {
        return;
      }
      return {
        tone: LogTone.Change,
        headline: `Stage instance in ${channelMention(event.newInstance.channelId)} was updated.`,
        details: changes,
        actor: await resolveAuditActor(
          event.newInstance.guild!,
          [AuditLogEvent.StageInstanceUpdate],
          event.newInstance.id
        ),
        footer: idFooter("Stage", event.newInstance.id),
      };
    });

    this.handleEvent(StageInstanceDeletedEvent, "stage", async event => ({
      tone: LogTone.Negative,
      headline: `Stage instance ended in ${channelMention(event.instance.channelId)}.`,
      details: [detailLine("Topic", event.instance.topic)],
      actor: await resolveAuditActor(
        event.instance.guild!,
        [AuditLogEvent.StageInstanceDelete],
        event.instance.id
      ),
      footer: idFooter("Stage", event.instance.id),
    }));

    this.handleEvent(ScheduledEventCreatedEvent, "scheduled_event", async event => ({
      tone: LogTone.Positive,
      headline: `Scheduled event ${scheduledEventName(event.scheduledEvent)} was created.`,
      details: scheduledEventDetailLines(event.scheduledEvent),
      actor: await resolveAuditActor(
        event.guild!,
        [AuditLogEvent.GuildScheduledEventCreate],
        event.scheduledEvent.id
      ),
      footer: idFooter("Event", event.scheduledEvent.id),
    }));

    this.handleEvent(ScheduledEventUpdatedEvent, "scheduled_event", async event => {
      const changes = describeScheduledEventChanges(event.oldEvent, event.newEvent);
      if (changes.length === 0) {
        return;
      }
      return {
        tone: LogTone.Change,
        headline: `Scheduled event ${scheduledEventName(event.newEvent)} was updated.`,
        details: changes,
        actor: await resolveAuditActor(
          event.guild!,
          [AuditLogEvent.GuildScheduledEventUpdate],
          event.newEvent.id
        ),
        footer: idFooter("Event", event.newEvent.id),
      };
    });

    this.handleEvent(ScheduledEventDeletedEvent, "scheduled_event", async event => ({
      tone: LogTone.Negative,
      headline: `Scheduled event ${scheduledEventName(event.scheduledEvent)} was deleted.`,
      details: scheduledEventDetailLines(event.scheduledEvent),
      actor: await resolveAuditActor(
        event.guild!,
        [AuditLogEvent.GuildScheduledEventDelete],
        event.scheduledEvent.id
      ),
      footer: idFooter("Event", event.scheduledEvent.id),
    }));

    this.handleEvent(ScheduledEventUserAddedEvent, "scheduled_event", async event =>
      this.interestCard(event.user, event.scheduledEvent, LogTone.Positive, "is interested in")
    );

    this.handleEvent(ScheduledEventUserRemovedEvent, "scheduled_event", async event =>
      this.interestCard(event.user, event.scheduledEvent, LogTone.Negative, "is no longer interested in")
    );

    this.handleEvent(AutoModRuleCreatedEvent, "automod", async event => ({
      tone: LogTone.Positive,
      headline: `AutoMod rule ${code(event.rule.name)} was created.`,
      details: automodRuleDetailLines(event.rule),
      actor: await resolveAuditActor(
        event.rule.guild,
        [AuditLogEvent.AutoModerationRuleCreate],
        event.rule.id
      ),
      footer: idFooter("Rule", event.rule.id),
    }));

    this.handleEvent(AutoModRuleUpdatedEvent, "automod", async event => {
      const changes = describeAutomodRuleChanges(event.oldRule, event.newRule);
      if (changes.length === 0) {
        return;
      }
      return {
        tone: LogTone.Change,
        headline: `AutoMod rule ${code(event.newRule.name)} was updated.`,
        details: changes,
        actor: await resolveAuditActor(
          event.newRule.guild,
          [AuditLogEvent.AutoModerationRuleUpdate],
          event.newRule.id
        ),
        footer: idFooter("Rule", event.newRule.id),
      };
    });

    this.handleEvent(AutoModRuleDeletedEvent, "automod", async event => ({
      tone: LogTone.Negative,
      headline: `AutoMod rule ${code(event.rule.name)} was deleted.`,
      actor: await resolveAuditActor(
        event.rule.guild,
        [AuditLogEvent.AutoModerationRuleDelete],
        event.rule.id
      ),
      footer: idFooter("Rule", event.rule.id),
    }));

    this.handleEvent(AutoModActionExecutedEvent, "automod", async event => {
      const { execution } = event;
      return {
        tone: LogTone.Negative,
        headline: `AutoMod rule ${automodRuleLabel(execution.autoModerationRule, execution.ruleId)} took action.`,
        details: automodExecutionLines(execution),
        subject: execution.member ?? execution.user,
        footer: idFooter("Rule", execution.ruleId),
      };
    });

    this.handleEvent(RoleCreatedEvent, "role", async event => ({
      tone: LogTone.Positive,
      headline: `${event.role} was created.`,
      details: [
        detailLine("Name", code(event.role.name)),
        detailLine("Color", code(event.role.hexColor)),
        detailLine("Hoisted", yesNo(event.role.hoist)),
        detailLine("Mentionable", yesNo(event.role.mentionable)),
      ],
      actor: await resolveAuditActor(event.role.guild, [AuditLogEvent.RoleCreate], event.role.id),
      footer: idFooter("Role", event.role.id),
    }));

    this.handleEvent(RoleUpdatedEvent, "role", async event => {
      const changes = describeRoleChanges(event.oldRole, event.newRole);
      if (changes.length === 0) {
        return;
      }
      return {
        tone: LogTone.Change,
        headline: `${event.newRole} was updated.`,
        details: changes,
        actor: await resolveAuditActor(event.newRole.guild, [AuditLogEvent.RoleUpdate], event.newRole.id),
        footer: idFooter("Role", event.newRole.id),
      };
    });

    // The role no longer exists, so a mention would render as "@deleted-role".
    this.handleEvent(RoleDeletedEvent, "role", async event => ({
      tone: LogTone.Negative,
      headline: `Role ${code(event.role.name)} was deleted.`,
      details: [detailLine("Color", code(event.role.hexColor))],
      actor: await resolveAuditActor(event.role.guild, [AuditLogEvent.RoleDelete], event.role.id),
      footer: idFooter("Role", event.role.id),
    }));

    this.handleEvent(EmojiCreatedEvent, "emoji", async event => ({
      tone: LogTone.Positive,
      headline: `Emoji ${event.emoji} was created.`,
      details: [
        detailLine("Name", code(event.emoji.name ?? event.emoji.id)),
        detailLine("Animated", yesNo(event.emoji.animated)),
      ],
      actor: await resolveAuditActor(event.emoji.guild, [AuditLogEvent.EmojiCreate], event.emoji.id),
      thumbnail: event.emoji.imageURL({ size: 4096 }),
      footer: idFooter("Emoji", event.emoji.id),
    }));

    this.handleEvent(EmojiUpdatedEvent, "emoji", async event => {
      const changes = describeEmojiChanges(event.oldEmoji, event.newEmoji);
      if (changes.length === 0) {
        return;
      }
      return {
        tone: LogTone.Change,
        headline: `Emoji ${event.newEmoji} was updated.`,
        details: changes,
        actor: await resolveAuditActor(event.newEmoji.guild, [AuditLogEvent.EmojiUpdate], event.newEmoji.id),
        thumbnail: event.newEmoji.imageURL({ size: 4096 }),
        footer: idFooter("Emoji", event.newEmoji.id),
      };
    });

    this.handleEvent(EmojiDeletedEvent, "emoji", async event => ({
      tone: LogTone.Negative,
      headline: `Emoji ${code(event.emoji.name ?? event.emoji.id)} was deleted.`,
      details: [detailLine("Animated", yesNo(event.emoji.animated))],
      actor: await resolveAuditActor(event.emoji.guild, [AuditLogEvent.EmojiDelete], event.emoji.id),
      thumbnail: event.emoji.imageURL({ size: 4096 }),
      footer: idFooter("Emoji", event.emoji.id),
    }));

    this.handleEvent(StickerCreatedEvent, "sticker", async event => ({
      tone: LogTone.Positive,
      headline: `Sticker ${code(event.sticker.name)} was created.`,
      details: [
        detailLine("Description", event.sticker.description || "None"),
        detailLine("Format", stickerFormatLabel(event.sticker.format)),
        detailLine("Tags", event.sticker.tags || "None"),
      ],
      actor: await resolveAuditActor(event.guild!, [AuditLogEvent.StickerCreate], event.sticker.id),
      image: event.sticker.url,
      footer: idFooter("Sticker", event.sticker.id),
    }));

    this.handleEvent(StickerUpdatedEvent, "sticker", async event => {
      const changes = describeStickerChanges(event.oldSticker, event.newSticker);
      if (changes.length === 0) {
        return;
      }
      return {
        tone: LogTone.Change,
        headline: `Sticker ${code(event.newSticker.name)} was updated.`,
        details: changes,
        actor: await resolveAuditActor(event.guild!, [AuditLogEvent.StickerUpdate], event.newSticker.id),
        image: event.newSticker.url,
        footer: idFooter("Sticker", event.newSticker.id),
      };
    });

    this.handleEvent(StickerDeletedEvent, "sticker", async event => ({
      tone: LogTone.Negative,
      headline: `Sticker ${code(event.sticker.name)} was deleted.`,
      details: [detailLine("Format", stickerFormatLabel(event.sticker.format))],
      actor: await resolveAuditActor(event.guild!, [AuditLogEvent.StickerDelete], event.sticker.id),
      image: event.sticker.url,
      footer: idFooter("Sticker", event.sticker.id),
    }));

    this.handleEvent(MemberBannedEvent, "ban", async event => {
      const { ban } = event;
      const actor = await resolveAuditActor(ban.guild, [AuditLogEvent.MemberBanAdd], ban.user.id);
      // The ban carries its own reason even when the audit entry is missing.
      const reason = ban.reason ?? actor?.reason ?? null;
      return {
        tone: LogTone.Negative,
        headline: `${ban.user} was banned.`,
        details: !actor && reason ? [detailLine("Reason", reason)] : [],
        actor: actor && { ...actor, reason },
        subject: ban.user,
        footer: idFooter("User", ban.user.id),
      };
    });

    this.handleEvent(MemberUnbannedEvent, "ban", async event => ({
      tone: LogTone.Positive,
      headline: `${event.ban.user} was unbanned.`,
      actor: await resolveAuditActor(event.ban.guild, [AuditLogEvent.MemberBanRemove], event.ban.user.id),
      subject: event.ban.user,
      footer: idFooter("User", event.ban.user.id),
    }));

    this.handleEvent(InviteCreatedEvent, "invite", async event => {
      const { invite } = event;
      return {
        tone: LogTone.Positive,
        headline: `Invite ${code(invite.code)} was created.`,
        details: [
          detailLine("Channel", channelMention(invite.channel?.id, "Unknown")),
          detailLine("Expires", invite.expiresAt ? timestamp(invite.expiresAt) : "Never"),
          detailLine("Max Uses", invite.maxUses ? formatCount(invite.maxUses) : "Unlimited"),
          ...(invite.inviter ? [detailLine("Created By", invite.inviter.toString())] : []),
        ],
        subject: invite.inviter,
      };
    });

    this.handleEvent(InviteDeletedEvent, "invite", async event => ({
      tone: LogTone.Negative,
      headline: `Invite ${code(event.invite.code)} was deleted.`,
      actor: await resolveAuditActor(event.guild!, [AuditLogEvent.InviteDelete], event.invite.code),
    }));
  }

  private interestCard(
    user: User | PartialUser,
    scheduledEvent: ScheduledEvent,
    tone: LogTone,
    verb: string
  ): LogCard {
    return {
      tone,
      headline: `${user} ${verb} ${scheduledEventName(scheduledEvent)}.`,
      details: [detailLine("Interested", formatCount(scheduledEvent.userCount ?? 0))],
      subject: user,
      footer: idFooter("Event", scheduledEvent.id),
    };
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
    callback: (event: T) => Promise<LogCard | void>
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
          const card = await callback(event);
          if (card) {
            await channel.send({ embeds: [buildLogCard(guild, card)] });
          }
        } catch (error) {
          console.error(`Failed to post the ${logType} log for guild ${event.guild?.id}:`, error);
        }
      },
      { featureId: FeatureIds.Logging }
    );
  }
}
