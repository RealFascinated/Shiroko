import { ClusterManager } from "discord-hybrid-sharding";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db/index";
import { env } from "./lib/env";
import { formatDuration } from "./lib/time";
import StorageService from "./storage/storage";

const beforeMigrate = Date.now();
await migrate(db, { migrationsFolder: "./drizzle" });
console.log(`Migrations complete in ${formatDuration(Date.now() - beforeMigrate)}`);
// The manager runs no queries after migrating; release its connections so they don't count against the clusters' budget.
await pool.end();

await StorageService.init();

const manager = new ClusterManager(`${import.meta.dir}/index.ts`, {
  totalShards: env.SHARD_COUNT ? Number(env.SHARD_COUNT) : "auto",
  shardsPerClusters: env.SHARDS_PER_CLUSTER ? Number(env.SHARDS_PER_CLUSTER) : undefined,
  mode: "process",
  token: env.DISCORD_BOT_TOKEN,
  // `bun --watch src/manager.ts` only watches the manager's own imports; forwarding the flag makes each cluster reload on its own source changes.
  execArgv: process.execArgv,
});

manager.on("clusterCreate", cluster => {
  console.log(`Cluster ${cluster.id} spawned (shards ${cluster.shardList.join(", ")})`);
  cluster.on("death", () => console.warn(`Cluster ${cluster.id} died`));
});
manager.on("clusterReady", cluster => console.log(`Cluster ${cluster.id} ready`));

function shutdown(): void {
  for (const cluster of manager.clusters.values()) {
    cluster.kill({ force: true });
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await manager.spawn();
