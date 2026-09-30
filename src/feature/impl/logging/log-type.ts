/**
 * Every log type the logging feature can emit, keyed by the string stored
 * in the `logging` table. A row enables one type for one guild; absence
 * means off. This is the single source of truth for the `/logging toggle`
 * choices and their labels.
 */
export const logTypes = {
  member_join: { label: "Member Join" },
  member_leave: { label: "Member Leave" },
  avatar_update: { label: "Avatar Update" },
  username_update: { label: "Username Update" },
  display_name_update: { label: "Display Name Update" },
  role_add: { label: "Role Added" },
  role_remove: { label: "Role Removed" },
} as const;

export type LogType = keyof typeof logTypes;
