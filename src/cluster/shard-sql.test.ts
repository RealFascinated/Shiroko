import { expect, test } from "bun:test";
import { shardIdForGuildId } from "discord-hybrid-sharding";
import type { Client } from "discord.js";
import { PgDialect } from "drizzle-orm/pg-core";
import { voiceSessionsSchema } from "@/db/schemas/voice-sessions";
import { ownedByCluster } from "./shard-sql";

test("ownedByCluster binds the shard count and this cluster's shards", () => {
  const client = { cluster: { info: { SHARD_LIST: [2, 3], TOTAL_SHARDS: 4 } } } as unknown as Client;
  const query = new PgDialect().sqlToQuery(ownedByCluster(voiceSessionsSchema.guildId, client));
  expect(query.params).toEqual([4, 2, 3]);
});

test("the SQL formula agrees with the library's shard routing", () => {
  for (const guildId of ["81384788765712384", "1138937019428556821", "9223372036854775807"]) {
    expect(Number((BigInt(guildId) >> 22n) % 4n)).toBe(shardIdForGuildId(guildId, 4));
  }
});
