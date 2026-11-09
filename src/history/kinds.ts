import type Event from "../event/event";
import type { GuildHistoryKind, UserChangeEvent, UserHistoryKind } from "./history-kind";
import * as guildObjects from "./kinds/guild-objects";
import * as member from "./kinds/member";
import * as user from "./kinds/user";

export const USER_HISTORY_KINDS: UserHistoryKind<UserChangeEvent>[] = [
  new user.UsernameKind(),
  new user.DisplayNameKind(),
  new user.AvatarKind(),
  new user.BannerKind(),
];

export const MEMBER_HISTORY_KINDS: GuildHistoryKind<Event>[] = [
  new member.MemberJoinKind(),
  new member.MemberLeaveKind(),
  new member.MemberBanKind(),
  new member.MemberUnbanKind(),
  new member.NicknameKind(),
  new member.RolesKind(),
  new member.TimeoutKind(),
  new member.BoostKind(),
] as GuildHistoryKind<Event>[];

export const GUILD_OBJECT_HISTORY_KINDS: GuildHistoryKind<Event>[] = [
  new guildObjects.GuildUpdateKind(),
  new guildObjects.ChannelCreateKind(),
  new guildObjects.ChannelUpdateKind(),
  new guildObjects.ChannelDeleteKind(),
  new guildObjects.RoleCreateKind(),
  new guildObjects.RoleUpdateKind(),
  new guildObjects.RoleDeleteKind(),
  new guildObjects.EmojiCreateKind(),
  new guildObjects.EmojiUpdateKind(),
  new guildObjects.EmojiDeleteKind(),
  new guildObjects.StickerCreateKind(),
  new guildObjects.StickerUpdateKind(),
  new guildObjects.StickerDeleteKind(),
  new guildObjects.ThreadCreateKind(),
  new guildObjects.ThreadUpdateKind(),
  new guildObjects.ThreadDeleteKind(),
  new guildObjects.InviteCreateKind(),
  new guildObjects.InviteDeleteKind(),
] as GuildHistoryKind<Event>[];

export const GUILD_HISTORY_KINDS: GuildHistoryKind<Event>[] = [
  ...MEMBER_HISTORY_KINDS,
  ...GUILD_OBJECT_HISTORY_KINDS,
];

export const USER_KIND_BY_ID: Record<string, UserHistoryKind<UserChangeEvent>> = Object.fromEntries(
  USER_HISTORY_KINDS.map(kind => [kind.id, kind])
);

export const GUILD_KIND_BY_ID: Record<string, GuildHistoryKind<Event>> = Object.fromEntries(
  GUILD_HISTORY_KINDS.map(kind => [kind.id, kind])
);

/** One entry of the `/audit` type filter: a "thing" whose create/update/delete kinds are searched together. */
export interface HistoryGroup {
  id: string;
  label: string;
  kindIds: readonly string[];
}

const single = (kind: { id: string; label: string }): HistoryGroup => ({
  id: kind.id,
  label: kind.label,
  kindIds: [kind.id],
});

const group = (id: string, label: string): HistoryGroup => ({
  id,
  label,
  kindIds: GUILD_OBJECT_HISTORY_KINDS.filter(kind => kind.id.startsWith(`${id}_`)).map(kind => kind.id),
});

export const GUILD_HISTORY_GROUPS: HistoryGroup[] = [
  { id: "server", label: "Server", kindIds: ["guild_update"] },
  group("channel", "Channels"),
  group("role", "Roles"),
  group("emoji", "Emojis"),
  group("sticker", "Stickers"),
  group("thread", "Threads"),
  group("invite", "Invites"),
];

export const USER_HISTORY_GROUPS: HistoryGroup[] = [
  ...USER_HISTORY_KINDS.map(single),
  {
    id: "membership",
    label: "Joins, leaves and bans",
    kindIds: ["member_join", "member_leave", "member_ban", "member_unban"],
  },
  ...MEMBER_HISTORY_KINDS.filter(kind => !kind.id.startsWith("member_")).map(single),
];
