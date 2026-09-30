import type { LogType } from "@/feature/impl/logs";
import { boolean, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const logsSchema = pgTable(
  "logs",
  {
    guildId: text("guild_id").notNull(),
    logType: text("log_type").$type<LogType>().notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.logType] })]
);

export type LogSchema = typeof logsSchema.$inferSelect;
