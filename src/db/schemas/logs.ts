import type { LogType } from "@/feature/impl/logging/log-type";
import { boolean, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const logsSchema = pgTable(
  "logging",
  {
    guildId: text("guild_id").notNull(),
    logType: text("log_type").$type<LogType>().notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.logType] })]
);

export type LogSchema = typeof logsSchema.$inferSelect;
