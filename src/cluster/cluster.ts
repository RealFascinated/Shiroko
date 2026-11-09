import type { Client } from "discord.js";

/** Cluster 0 owns shard 0, so it also receives every DM. */
export function isPrimary(client: Client): boolean {
  return client.cluster.id === 0;
}

/**
 * Sums `count` over every cluster. Null while any cluster can't answer
 * (not spawned yet, respawning, or timed out), so a partial total never gets
 * published as the bot's real size.
 */
async function sumAcrossClusters(client: Client, count: (client: Client) => number): Promise<number | null> {
  const results = await client.cluster.broadcastEval(count).catch(() => null);
  if (results?.length !== client.cluster.count) {
    return null;
  }
  return results.reduce((total, value) => total + value, 0);
}

export function guildCount(client: Client): Promise<number | null> {
  return sumAcrossClusters(client, c => c.guilds.cache.size);
}

export function cachedUserCount(client: Client): Promise<number | null> {
  return sumAcrossClusters(client, c => c.users.cache.size);
}

/** Reads `voice.adapters` because the eval'd function is serialized and can't import `@discordjs/voice`. */
export function voiceConnectionCount(client: Client): Promise<number | null> {
  return sumAcrossClusters(client, c => c.voice.adapters.size);
}
