import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const permissionRoles = pgTable(
  "permission_roles",
  {
    guildId: text("guild_id").notNull(),
    roleId: text("role_id").notNull(),
    flags: text("flags").notNull().default("0"),
    parentRoleId: text("parent_role_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.roleId] })]
);

export type PermissionRoleSchema = typeof permissionRoles.$inferSelect;
