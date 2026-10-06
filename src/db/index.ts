import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { commandCallsSchema } from "./schemas/command-calls";
import { globalUsersSchema } from "./schemas/global-users";
import { guildBirthdaysSchema } from "./schemas/guild-birthdays";
import { guildInvitesSchema } from "./schemas/guild-invites";
import { permissionRolesSchema } from "./schemas/guild-permissions";
import { guildSettingsSchema } from "./schemas/guild-settings";
import { guildUsersSchema } from "./schemas/guild-users";
import { interactionsSchema } from "./schemas/interactions";
import { inviteJoinsSchema } from "./schemas/invite-joins";
import { mediaSchema } from "./schemas/media";
import { messageEventsSchema } from "./schemas/message-events";
import { remindersSchema } from "./schemas/reminders";
import { userLevelsSchema } from "./schemas/user-levels";
import { voiceSessionsSchema } from "./schemas/voice-sessions";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const schema = {
  commandCalls: commandCallsSchema,
  globalUsers: globalUsersSchema,
  guildBirthdays: guildBirthdaysSchema,
  guildUsers: guildUsersSchema,
  permissionRoles: permissionRolesSchema,
  guildSettings: guildSettingsSchema,
  guildInvites: guildInvitesSchema,
  inviteJoins: inviteJoinsSchema,
  userLevels: userLevelsSchema,
  interactions: interactionsSchema,
  media: mediaSchema,
  messageEvents: messageEventsSchema,
  reminders: remindersSchema,
  voiceSessions: voiceSessionsSchema,
};

export const db = drizzle(pool, { schema });

/** The database handle type used for both top-level calls and transactions. */
export type DbClient = NodePgDatabase<typeof schema>;

export const now = sql`now()`;
