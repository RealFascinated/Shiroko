import {
  AuditLogEvent,
  type AnyThreadChannel,
  type Guild,
  type GuildEmoji,
  type Role,
  type Sticker,
} from "discord.js";
import type { NonThreadGuildBasedChannel } from "discord.js";
import type Event from "../../event/event";
import ChannelCreatedEvent from "../../event/events/channel-created.event";
import ChannelDeletedEvent from "../../event/events/channel-deleted.event";
import ChannelUpdatedEvent from "../../event/events/channel-updated.event";
import EmojiCreatedEvent from "../../event/events/emoji-created.event";
import EmojiDeletedEvent from "../../event/events/emoji-deleted.event";
import EmojiUpdatedEvent from "../../event/events/emoji-updated.event";
import GuildUpdatedEvent from "../../event/events/guild-updated.event";
import InviteCreatedEvent from "../../event/events/invite-created.event";
import InviteDeletedEvent from "../../event/events/invite-deleted.event";
import RoleCreatedEvent from "../../event/events/role-created.event";
import RoleDeletedEvent from "../../event/events/role-deleted.event";
import RoleUpdatedEvent from "../../event/events/role-updated.event";
import StickerCreatedEvent from "../../event/events/sticker-created.event";
import StickerDeletedEvent from "../../event/events/sticker-deleted.event";
import StickerUpdatedEvent from "../../event/events/sticker-updated.event";
import ThreadCreatedEvent from "../../event/events/thread-created.event";
import ThreadDeletedEvent from "../../event/events/thread-deleted.event";
import ThreadUpdatedEvent from "../../event/events/thread-updated.event";
import type { JsonValue } from "../../db/schemas/guild-settings";
import { diffFields, GuildHistoryKind, type GuildHistoryDraft } from "../history-kind";

type Fields = Record<string, JsonValue>;

function created(guild: Guild | null, subjectId: string, fields: Fields): GuildHistoryDraft | null {
  return guild && { guild, subjectId, oldValue: null, newValue: fields };
}

function deleted(guild: Guild | null, subjectId: string, fields: Fields): GuildHistoryDraft | null {
  return guild && { guild, subjectId, oldValue: fields, newValue: null };
}

function updated(
  guild: Guild | null,
  subjectId: string,
  before: Fields,
  after: Fields
): GuildHistoryDraft | null {
  const change = diffFields(before, after);
  return guild && change && { guild, subjectId, ...change };
}

function channelFields(channel: NonThreadGuildBasedChannel): Fields {
  return {
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId,
    topic: "topic" in channel ? (channel.topic ?? null) : null,
    nsfw: "nsfw" in channel ? channel.nsfw : null,
    slowmode: "rateLimitPerUser" in channel ? (channel.rateLimitPerUser ?? null) : null,
  };
}

function roleFields(role: Role): Fields {
  return {
    name: role.name,
    color: role.hexColor,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield.toString(),
  };
}

function emojiFields(emoji: GuildEmoji): Fields {
  return { name: emoji.name, animated: emoji.animated };
}

function stickerFields(sticker: Sticker): Fields {
  return { name: sticker.name, description: sticker.description, tags: sticker.tags };
}

function threadFields(thread: AnyThreadChannel): Fields {
  return {
    name: thread.name,
    parentId: thread.parentId,
    archived: thread.archived,
    locked: thread.locked,
    slowmode: thread.rateLimitPerUser,
    autoArchiveMinutes: thread.autoArchiveDuration,
  };
}

abstract class ChannelKind<
  E extends ChannelCreatedEvent | ChannelDeletedEvent | ChannelUpdatedEvent,
> extends GuildHistoryKind<E> {
  protected override mention(subjectId: string): string {
    return `<#${subjectId}>`;
  }
}

export class ChannelCreateKind extends ChannelKind<ChannelCreatedEvent> {
  public readonly id: string = "channel_create";
  public readonly label: string = "Channel created";
  public readonly eventClass: new (...args: any[]) => ChannelCreatedEvent = ChannelCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ChannelCreate];

  public draft(event: ChannelCreatedEvent): GuildHistoryDraft | null {
    return created(event.guildData, event.channelId, channelFields(event.channel));
  }
}

export class ChannelUpdateKind extends ChannelKind<ChannelUpdatedEvent> {
  public readonly id: string = "channel_update";
  public readonly label: string = "Channel updated";
  public readonly eventClass: new (...args: any[]) => ChannelUpdatedEvent = ChannelUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ChannelUpdate];

  public draft(event: ChannelUpdatedEvent): GuildHistoryDraft | null {
    return updated(
      event.guildData,
      event.channelId,
      channelFields(event.oldChannel),
      channelFields(event.newChannel)
    );
  }
}

export class ChannelDeleteKind extends ChannelKind<ChannelDeletedEvent> {
  public readonly id: string = "channel_delete";
  public readonly label: string = "Channel deleted";
  public readonly eventClass: new (...args: any[]) => ChannelDeletedEvent = ChannelDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ChannelDelete];

  public draft(event: ChannelDeletedEvent): GuildHistoryDraft | null {
    return deleted(event.guildData, event.channelId, channelFields(event.channel));
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}

abstract class RoleKind<
  E extends RoleCreatedEvent | RoleDeletedEvent | RoleUpdatedEvent,
> extends GuildHistoryKind<E> {
  protected override mention(subjectId: string): string {
    return `<@&${subjectId}>`;
  }
}

export class RoleCreateKind extends RoleKind<RoleCreatedEvent> {
  public readonly id: string = "role_create";
  public readonly label: string = "Role created";
  public readonly eventClass: new (...args: any[]) => RoleCreatedEvent = RoleCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.RoleCreate];

  public draft(event: RoleCreatedEvent): GuildHistoryDraft | null {
    return created(event.guildData, event.roleId, roleFields(event.role));
  }
}

export class RoleUpdateKind extends RoleKind<RoleUpdatedEvent> {
  public readonly id: string = "role_update";
  public readonly label: string = "Role updated";
  public readonly eventClass: new (...args: any[]) => RoleUpdatedEvent = RoleUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.RoleUpdate];

  public draft(event: RoleUpdatedEvent): GuildHistoryDraft | null {
    return updated(event.guildData, event.roleId, roleFields(event.oldRole), roleFields(event.newRole));
  }
}

export class RoleDeleteKind extends RoleKind<RoleDeletedEvent> {
  public readonly id: string = "role_delete";
  public readonly label: string = "Role deleted";
  public readonly eventClass: new (...args: any[]) => RoleDeletedEvent = RoleDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.RoleDelete];

  public draft(event: RoleDeletedEvent): GuildHistoryDraft | null {
    return deleted(event.guildData, event.roleId, roleFields(event.role));
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}

abstract class IdKind<E extends Event> extends GuildHistoryKind<E> {
  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}

export class EmojiCreateKind extends IdKind<EmojiCreatedEvent> {
  public readonly id: string = "emoji_create";
  public readonly label: string = "Emoji created";
  public readonly eventClass: new (...args: any[]) => EmojiCreatedEvent = EmojiCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.EmojiCreate];

  public draft(event: EmojiCreatedEvent): GuildHistoryDraft | null {
    return created(event.guildData, event.emojiId, emojiFields(event.emoji));
  }
}

export class EmojiUpdateKind extends IdKind<EmojiUpdatedEvent> {
  public readonly id: string = "emoji_update";
  public readonly label: string = "Emoji updated";
  public readonly eventClass: new (...args: any[]) => EmojiUpdatedEvent = EmojiUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.EmojiUpdate];

  public draft(event: EmojiUpdatedEvent): GuildHistoryDraft | null {
    return updated(event.guildData, event.emojiId, emojiFields(event.oldEmoji), emojiFields(event.newEmoji));
  }
}

export class EmojiDeleteKind extends IdKind<EmojiDeletedEvent> {
  public readonly id: string = "emoji_delete";
  public readonly label: string = "Emoji deleted";
  public readonly eventClass: new (...args: any[]) => EmojiDeletedEvent = EmojiDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.EmojiDelete];

  public draft(event: EmojiDeletedEvent): GuildHistoryDraft | null {
    return deleted(event.guildData, event.emojiId, emojiFields(event.emoji));
  }
}

export class StickerCreateKind extends IdKind<StickerCreatedEvent> {
  public readonly id: string = "sticker_create";
  public readonly label: string = "Sticker created";
  public readonly eventClass: new (...args: any[]) => StickerCreatedEvent = StickerCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.StickerCreate];

  public draft(event: StickerCreatedEvent): GuildHistoryDraft | null {
    return created(event.guildData, event.stickerId, stickerFields(event.sticker));
  }
}

export class StickerUpdateKind extends IdKind<StickerUpdatedEvent> {
  public readonly id: string = "sticker_update";
  public readonly label: string = "Sticker updated";
  public readonly eventClass: new (...args: any[]) => StickerUpdatedEvent = StickerUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.StickerUpdate];

  public draft(event: StickerUpdatedEvent): GuildHistoryDraft | null {
    return updated(
      event.guildData,
      event.stickerId,
      stickerFields(event.oldSticker),
      stickerFields(event.newSticker)
    );
  }
}

export class StickerDeleteKind extends IdKind<StickerDeletedEvent> {
  public readonly id: string = "sticker_delete";
  public readonly label: string = "Sticker deleted";
  public readonly eventClass: new (...args: any[]) => StickerDeletedEvent = StickerDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.StickerDelete];

  public draft(event: StickerDeletedEvent): GuildHistoryDraft | null {
    return deleted(event.guildData, event.stickerId, stickerFields(event.sticker));
  }
}

abstract class ThreadKind<
  E extends ThreadCreatedEvent | ThreadDeletedEvent | ThreadUpdatedEvent,
> extends GuildHistoryKind<E> {
  protected override mention(subjectId: string): string {
    return `<#${subjectId}>`;
  }
}

export class ThreadCreateKind extends ThreadKind<ThreadCreatedEvent> {
  public readonly id: string = "thread_create";
  public readonly label: string = "Thread created";
  public readonly eventClass: new (...args: any[]) => ThreadCreatedEvent = ThreadCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ThreadCreate];

  public draft({ thread }: ThreadCreatedEvent): GuildHistoryDraft | null {
    return created(thread.guild, thread.id, threadFields(thread));
  }
}

export class ThreadUpdateKind extends ThreadKind<ThreadUpdatedEvent> {
  public readonly id: string = "thread_update";
  public readonly label: string = "Thread updated";
  public readonly eventClass: new (...args: any[]) => ThreadUpdatedEvent = ThreadUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ThreadUpdate];

  public draft({ oldThread, newThread }: ThreadUpdatedEvent): GuildHistoryDraft | null {
    return updated(newThread.guild, newThread.id, threadFields(oldThread), threadFields(newThread));
  }
}

export class ThreadDeleteKind extends ThreadKind<ThreadDeletedEvent> {
  public readonly id: string = "thread_delete";
  public readonly label: string = "Thread deleted";
  public readonly eventClass: new (...args: any[]) => ThreadDeletedEvent = ThreadDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ThreadDelete];

  public draft({ thread }: ThreadDeletedEvent): GuildHistoryDraft | null {
    return deleted(thread.guild, thread.id, threadFields(thread));
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}

export class InviteCreateKind extends IdKind<InviteCreatedEvent> {
  public readonly id: string = "invite_create";
  public readonly label: string = "Invite created";
  public readonly eventClass: new (...args: any[]) => InviteCreatedEvent = InviteCreatedEvent;

  public draft({ guild, invite }: InviteCreatedEvent): GuildHistoryDraft | null {
    return (
      guild && {
        guild,
        subjectId: invite.code,
        oldValue: null,
        newValue: {
          channelId: invite.channelId,
          inviterId: invite.inviter?.id ?? null,
          maxUses: invite.maxUses,
          maxAgeSeconds: invite.maxAge,
        },
      }
    );
  }
}

export class InviteDeleteKind extends IdKind<InviteDeletedEvent> {
  public readonly id: string = "invite_delete";
  public readonly label: string = "Invite deleted";
  public readonly eventClass: new (...args: any[]) => InviteDeletedEvent = InviteDeletedEvent;

  public draft({ guild, invite }: InviteDeletedEvent): GuildHistoryDraft | null {
    return (
      guild && {
        guild,
        subjectId: invite.code,
        oldValue: { channelId: invite.channelId, inviterId: invite.inviter?.id ?? null },
        newValue: null,
      }
    );
  }
}

export class GuildUpdateKind extends GuildHistoryKind<GuildUpdatedEvent> {
  public readonly id: string = "guild_update";
  public readonly label: string = "Server updated";
  public readonly eventClass: new (...args: any[]) => GuildUpdatedEvent = GuildUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.GuildUpdate];

  public draft({ oldGuild, guildData }: GuildUpdatedEvent): GuildHistoryDraft | null {
    const fields = (guild: GuildUpdatedEvent["guildData"]): Fields => ({
      name: guild.name,
      icon: guild.icon,
      banner: guild.banner,
      splash: guild.splash,
      description: guild.description,
      ownerId: guild.ownerId,
      vanityCode: guild.vanityURLCode,
      verificationLevel: guild.verificationLevel,
      afkChannelId: guild.afkChannelId,
      systemChannelId: guild.systemChannelId,
    });
    const change = diffFields(fields(oldGuild), fields(guildData));
    return change && { guild: guildData, subjectId: guildData.id, ...change };
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}
