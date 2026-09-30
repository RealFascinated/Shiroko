export const logTypes = {
  member_join: { label: "Member Join" },
  member_leave: { label: "Member Leave" },
  avatar_update: { label: "Avatar Update" },
  username_update: { label: "Username Update" },
  display_name_update: { label: "Display Name Update" },
  role_add: { label: "Role Added" },
  role_remove: { label: "Role Removed" },
  invite_create: { label: "Invite Created" },
  invite_delete: { label: "Invite Deleted" },
} as const;

export type LogType = keyof typeof logTypes;
