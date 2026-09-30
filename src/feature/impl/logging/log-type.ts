export const logTypes = {
  member_join: { label: "Member Join" },
  member_leave: { label: "Member Leave" },
  nickname_update: { label: "Nickname Update" },
  member_roles: { label: "Member Roles" },
  avatar_update: { label: "Avatar Update" },
  banner_update: { label: "Banner Update" },
  username_update: { label: "Username Update" },
  display_name_update: { label: "Display Name Update" },
  role: { label: "Roles" },
  channel: { label: "Channels" },
  emoji: { label: "Emojis" },
  sticker: { label: "Stickers" },
  ban: { label: "Bans" },
  invite: { label: "Invites" },
  server_update: { label: "Server Update" },
} as const;

export type LogType = keyof typeof logTypes;
