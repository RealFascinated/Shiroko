import type Event from "../event/event";
import type GuildEventKind from "./guild-event-kind";
import type GuildAuditKind from "./guild-audit-kind";
import type UserAuditKind from "./user-audit-kind";
import type { UserChangeEvent } from "./user-audit-kind";
import UsernameKind from "./impl/user/username.kind";
import DisplayNameKind from "./impl/user/display-name.kind";
import AvatarKind from "./impl/user/avatar.kind";
import BannerKind from "./impl/user/banner.kind";
import MemberJoinKind from "./impl/guild/member/member-join.kind";
import MemberLeaveKind from "./impl/guild/member/member-leave.kind";
import MemberBanKind from "./impl/guild/member/member-ban.kind";
import MemberUnbanKind from "./impl/guild/member/member-unban.kind";
import MemberNicknameKind from "./impl/guild/member/member-nickname.kind";
import MemberRolesKind from "./impl/guild/member/member-roles.kind";
import MemberTimeoutKind from "./impl/guild/member/member-timeout.kind";
import MemberBoostKind from "./impl/guild/member/member-boost.kind";
import GuildUpdateKind from "./impl/guild/server/guild-update.kind";
import ChannelCreateKind from "./impl/guild/channel/channel-create.kind";
import ChannelUpdateKind from "./impl/guild/channel/channel-update.kind";
import ChannelDeleteKind from "./impl/guild/channel/channel-delete.kind";
import RoleCreateKind from "./impl/guild/role/role-create.kind";
import RoleUpdateKind from "./impl/guild/role/role-update.kind";
import RoleDeleteKind from "./impl/guild/role/role-delete.kind";
import EmojiCreateKind from "./impl/guild/emoji/emoji-create.kind";
import EmojiUpdateKind from "./impl/guild/emoji/emoji-update.kind";
import EmojiDeleteKind from "./impl/guild/emoji/emoji-delete.kind";
import StickerCreateKind from "./impl/guild/sticker/sticker-create.kind";
import StickerUpdateKind from "./impl/guild/sticker/sticker-update.kind";
import StickerDeleteKind from "./impl/guild/sticker/sticker-delete.kind";
import ThreadCreateKind from "./impl/guild/thread/thread-create.kind";
import ThreadUpdateKind from "./impl/guild/thread/thread-update.kind";
import ThreadDeleteKind from "./impl/guild/thread/thread-delete.kind";
import InviteCreateKind from "./impl/guild/invite/invite-create.kind";
import InviteDeleteKind from "./impl/guild/invite/invite-delete.kind";
import SettingsKind from "./impl/guild/config/settings.kind";
import PermissionsKind from "./impl/guild/config/permissions.kind";

export const USER_AUDIT_KINDS: UserAuditKind<UserChangeEvent>[] = [
  new UsernameKind(),
  new DisplayNameKind(),
  new AvatarKind(),
  new BannerKind(),
];

export const MEMBER_AUDIT_KINDS: GuildEventKind<Event>[] = [
  new MemberJoinKind(),
  new MemberLeaveKind(),
  new MemberBanKind(),
  new MemberUnbanKind(),
  new MemberNicknameKind(),
  new MemberRolesKind(),
  new MemberTimeoutKind(),
  new MemberBoostKind(),
];

export const GUILD_OBJECT_AUDIT_KINDS: GuildEventKind<Event>[] = [
  new GuildUpdateKind(),
  new ChannelCreateKind(),
  new ChannelUpdateKind(),
  new ChannelDeleteKind(),
  new RoleCreateKind(),
  new RoleUpdateKind(),
  new RoleDeleteKind(),
  new EmojiCreateKind(),
  new EmojiUpdateKind(),
  new EmojiDeleteKind(),
  new StickerCreateKind(),
  new StickerUpdateKind(),
  new StickerDeleteKind(),
  new ThreadCreateKind(),
  new ThreadUpdateKind(),
  new ThreadDeleteKind(),
  new InviteCreateKind(),
  new InviteDeleteKind(),
];

/** Recorded by `AuditWriter` in the transaction of the change, not from a gateway event. */
export const CONFIG_AUDIT_KINDS: GuildAuditKind[] = [new SettingsKind(), new PermissionsKind()];

export const GUILD_EVENT_KINDS: GuildEventKind<Event>[] = [
  ...MEMBER_AUDIT_KINDS,
  ...GUILD_OBJECT_AUDIT_KINDS,
];

export const GUILD_AUDIT_KINDS: GuildAuditKind[] = [...GUILD_EVENT_KINDS, ...CONFIG_AUDIT_KINDS];

export const USER_KIND_BY_ID: Record<string, UserAuditKind<UserChangeEvent>> = Object.fromEntries(
  USER_AUDIT_KINDS.map(kind => [kind.id, kind])
);

export const GUILD_KIND_BY_ID: Record<string, GuildAuditKind> = Object.fromEntries(
  GUILD_AUDIT_KINDS.map(kind => [kind.id, kind])
);

/** One entry of the `/audit` type filter: a "thing" whose create/update/delete kinds are searched together. */
export interface AuditGroup {
  id: string;
  label: string;
  kindIds: readonly string[];
}

const single = (kind: { id: string; label: string }): AuditGroup => ({
  id: kind.id,
  label: kind.label,
  kindIds: [kind.id],
});

const group = (id: string, label: string): AuditGroup => ({
  id,
  label,
  kindIds: GUILD_OBJECT_AUDIT_KINDS.filter(kind => kind.id.startsWith(`${id}_`)).map(kind => kind.id),
});

export const GUILD_AUDIT_GROUPS: AuditGroup[] = [
  { id: "server", label: "Server", kindIds: ["guild_update"] },
  group("channel", "Channels"),
  group("role", "Roles"),
  group("emoji", "Emojis"),
  group("sticker", "Stickers"),
  group("thread", "Threads"),
  group("invite", "Invites"),
];

export const CONFIG_AUDIT_GROUPS: AuditGroup[] = [
  { id: "settings", label: "Settings", kindIds: ["settings"] },
  { id: "permissions", label: "Permission roles", kindIds: ["permissions"] },
];

export const USER_AUDIT_GROUPS: AuditGroup[] = [
  ...USER_AUDIT_KINDS.map(single),
  {
    id: "membership",
    label: "Joins, leaves and bans",
    kindIds: ["member_join", "member_leave", "member_ban", "member_unban"],
  },
  ...MEMBER_AUDIT_KINDS.filter(kind => !kind.id.startsWith("member_")).map(single),
];
