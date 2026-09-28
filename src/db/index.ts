import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { globalUsers } from "./schemas/global-users";
import { guildFeatures } from "./schemas/guild-features";
import { guildInvites } from "./schemas/guild-invites";
import { permissionRoles } from "./schemas/guild-permissions";
import { guildSettings } from "./schemas/guild-settings";
import { guildUsers } from "./schemas/guild-users";
import { interactions } from "./schemas/interactions";
import { inviteJoins } from "./schemas/invite-joins";
import { levelRewards } from "./schemas/level-rewards";
import { messageEvents } from "./schemas/message-events";
import { userLevels } from "./schemas/user-levels";
import { voiceSessions } from "./schemas/voice-sessions";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const schema = {
  globalUsers,
  guildUsers,
  guildFeatures,
  permissionRoles,
  guildSettings,
  guildInvites,
  inviteJoins,
  userLevels,
  levelRewards,
  interactions,
  messageEvents,
  voiceSessions,
};

export const db = drizzle(pool, { schema });

/** The database handle type used for both top-level calls and transactions. */
export type DbClient = NodePgDatabase<typeof schema>;

export const now = sql`now()`;
