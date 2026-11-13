import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { birthdayAnnouncementsSchema } from "./schemas/birthday-announcements";
import { birthdayWishesSchema } from "./schemas/birthday-wishes";
import { commandCallsSchema } from "./schemas/command-calls";
import { componentsSchema } from "./schemas/components";
import { globalUsersSchema } from "./schemas/global-users";
import { guildBirthdaysSchema } from "./schemas/guild-birthdays";
import { guildAfkSchema } from "./schemas/guild-afk";
import { guildMarriagesSchema } from "./schemas/guild-marriages";
import { guildAuditSchema } from "./schemas/guild-audit";
import { guildInvitesSchema } from "./schemas/guild-invites";
import { permissionRolesSchema } from "./schemas/permission-roles";
import { guildSettingsSchema } from "./schemas/guild-settings";
import { guildUsersSchema } from "./schemas/guild-users";
import { interactionsSchema } from "./schemas/interactions";
import { inviteJoinsSchema } from "./schemas/invite-joins";
import { mediaSchema } from "./schemas/media";
import { messageEventsSchema } from "./schemas/message-events";
import { remindersSchema } from "./schemas/reminders";
import { triviaGuessesSchema } from "./schemas/trivia-guesses";
import { userAuditSchema } from "./schemas/user-audit";
import { userLevelsSchema } from "./schemas/user-levels";
import { voiceSessionsSchema } from "./schemas/voice-sessions";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const schema = {
  birthdayAnnouncements: birthdayAnnouncementsSchema,
  birthdayWishes: birthdayWishesSchema,
  commandCalls: commandCallsSchema,
  components: componentsSchema,
  globalUsers: globalUsersSchema,
  guildAfk: guildAfkSchema,
  guildBirthdays: guildBirthdaysSchema,
  guildAudit: guildAuditSchema,
  guildMarriages: guildMarriagesSchema,
  guildUsers: guildUsersSchema,
  permissionRoles: permissionRolesSchema,
  guildSettings: guildSettingsSchema,
  guildInvites: guildInvitesSchema,
  inviteJoins: inviteJoinsSchema,
  userAudit: userAuditSchema,
  userLevels: userLevelsSchema,
  interactions: interactionsSchema,
  media: mediaSchema,
  messageEvents: messageEventsSchema,
  reminders: remindersSchema,
  triviaGuesses: triviaGuessesSchema,
  voiceSessions: voiceSessionsSchema,
};

export const db = drizzle(pool, { schema });

/** The database handle type used for both top-level calls and transactions. */
export type DbClient = NodePgDatabase<typeof schema>;

export const now = sql`now()`;
