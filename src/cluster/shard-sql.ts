import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Client } from "discord.js";

/**
 * Discord's shard formula over a guild id column, matched against this
 * cluster's shards. It also matches guilds the bot has left, so their rows
 * still get swept by exactly one cluster.
 */
export function ownedByCluster(guildId: PgColumn, client: Client): SQL {
  const { SHARD_LIST, TOTAL_SHARDS } = client.cluster.info;
  return sql`((${guildId}::bigint >> 22) % ${TOTAL_SHARDS}) IN ${SHARD_LIST}`;
}
