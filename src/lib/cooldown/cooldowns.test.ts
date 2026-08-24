import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { remainingMs } from "../time";
import { Cooldowns } from "./cooldowns";
import DbCooldowns from "./impl/db-cooldowns";
import MemoryCooldowns from "./impl/memory-cooldowns";
import { cooldownKey } from "./key";

const backends: Array<[string, Cooldowns]> = [
  ["memory", new MemoryCooldowns()],
  ["db", new DbCooldowns()],
];

// Wipe the cooldowns table before the DB-backed tests so they don't collide
// with rows left by previous runs (or by the app touching the same table).
await db.execute(sql`TRUNCATE TABLE cooldowns`);

describe.each(backends)("%s cooldowns", (_, cooldowns) => {
  test("tryStart on a fresh key succeeds", async () => {
    const result = await cooldowns.tryStart(cooldownKey("123", "daily"), 1000);
    expect(result.ok).toBe(true);
    expect(result.cooldown.endsAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("tryStart while cooling down returns ok: false with the existing cooldown", async () => {
    await cooldowns.tryStart(cooldownKey("123", "work"), 60_000);
    const result = await cooldowns.tryStart(cooldownKey("123", "work"), 60_000, { streak: 3 });
    expect(result.ok).toBe(false);
    expect(result.cooldown.metadata).toBeUndefined();
  });

  test("tryStart stores and returns metadata", async () => {
    await cooldowns.tryStart(cooldownKey("123", "gamble"), 60_000, { wager: 100 });
    const result = await cooldowns.tryStart(cooldownKey("123", "gamble"), 60_000);
    expect(result.ok).toBe(false);
    expect(result.cooldown.metadata).toEqual({ wager: 100 });
  });

  test("tryStart succeeds after the previous cooldown is gone", async () => {
    // Deterministic: delete the old entry, then a fresh tryStart must win.
    await cooldowns.tryStart(cooldownKey("123", "daily"), 60_000);
    await cooldowns.delete(cooldownKey("123", "daily"));
    const result = await cooldowns.tryStart(cooldownKey("123", "daily"), 60_000);
    expect(result.ok).toBe(true);
    expect(remainingMs(result.cooldown.endsAt)).toBeGreaterThan(50_000);
  });

  test("get returns null while on cooldown, then null after expiry", async () => {
    await cooldowns.tryStart(cooldownKey("123", "beg"), 50);
    expect(await cooldowns.get(cooldownKey("123", "beg"))).not.toBeNull();
    await Bun.sleep(80);
    expect(await cooldowns.get(cooldownKey("123", "beg"))).toBeNull();
  });

  test("delete clears a cooldown immediately", async () => {
    await cooldowns.tryStart(cooldownKey("123", "beg"), 60_000);
    expect(await cooldowns.isOnCooldown(cooldownKey("123", "beg"))).toBe(true);
    await cooldowns.delete(cooldownKey("123", "beg"));
    expect(await cooldowns.isOnCooldown(cooldownKey("123", "beg"))).toBe(false);
  });

  test("clear removes every cooldown for a user", async () => {
    await cooldowns.tryStart(cooldownKey("123", "gamble"), 60_000);
    await cooldowns.tryStart(cooldownKey("123", "daily"), 60_000);
    await cooldowns.tryStart(cooldownKey("456", "gamble"), 60_000);
    await cooldowns.clear("123");
    expect(await cooldowns.isOnCooldown(cooldownKey("123", "gamble"))).toBe(false);
    expect(await cooldowns.isOnCooldown(cooldownKey("123", "daily"))).toBe(false);
    expect(await cooldowns.isOnCooldown(cooldownKey("456", "gamble"))).toBe(true);
  });

  test("clear with a user id that ends with ':' matches only that user", async () => {
    const key = cooldownKey("1:23", "daily");
    await cooldowns.tryStart(key, 60_000);
    const other = cooldownKey("1:2", "daily");
    await cooldowns.tryStart(other, 60_000);
    await cooldowns.clear("1:23");
    expect(await cooldowns.isOnCooldown(key)).toBe(false);
    expect(await cooldowns.isOnCooldown(other)).toBe(true);
  });

  test("delete removes a bare key (no user prefix)", async () => {
    await cooldowns.tryStart("123", 60_000);
    await cooldowns.delete("123");
    expect(await cooldowns.isOnCooldown("123")).toBe(false);
  });
});
