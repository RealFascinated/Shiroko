import { expect, test } from "bun:test";
import type { Client } from "discord.js";
import { formatClusterId, formatShardId, guildCount, isPrimary } from "./cluster";

function fakeClient(id: number, count: number, eval_: () => Promise<number[]>): Client {
  return { cluster: { id, count, broadcastEval: eval_ } } as unknown as Client;
}

test("isPrimary is cluster 0 only", () => {
  expect(isPrimary(fakeClient(0, 2, async () => []))).toBe(true);
  expect(isPrimary(fakeClient(1, 2, async () => []))).toBe(false);
});

test("cluster and shard ids are shown 1-based", () => {
  expect(formatClusterId(0)).toBe("1");
  expect(formatShardId(3)).toBe("4");
});

test("guildCount sums every cluster's answer", async () => {
  expect(await guildCount(fakeClient(0, 3, async () => [10, 20, 5]))).toBe(35);
});

test("guildCount is null while a cluster is missing", async () => {
  expect(await guildCount(fakeClient(0, 2, async () => [10]))).toBeNull();
});

test("guildCount is null when the eval fails", async () => {
  expect(
    await guildCount(
      fakeClient(0, 2, async () => {
        throw new Error("cluster respawning");
      })
    )
  ).toBeNull();
});
