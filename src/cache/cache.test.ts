import { describe, expect, test } from "bun:test";
import { Cache } from "./cache";
import { guildKey, guildScope, userKey, userScope, type CacheKey } from "./key";

function newCache(): Cache<number> {
  return new Cache<number>({ name: `test-${Math.random()}`, mode: "authoritative" });
}

describe("Cache", () => {
  test("loads once, then serves from the cache", async () => {
    const cache = newCache();
    let calls = 0;
    const loader = async (): Promise<number> => {
      calls++;
      return 42;
    };
    const key = guildKey("g1");
    expect(await cache.load(key, loader)).toBe(42);
    expect(await cache.load(key, loader)).toBe(42);
    expect(calls).toBe(1);
  });

  test("invalidate forces the next load", async () => {
    const cache = newCache();
    let calls = 0;
    const loader = async (): Promise<number> => ++calls;
    const key = guildKey("g1");
    expect(await cache.load(key, loader)).toBe(1);
    cache.invalidate(key);
    expect(await cache.load(key, loader)).toBe(2);
  });

  test("purgeScope drops only entries carrying the tag", async () => {
    const cache = newCache();
    const loader = async (): Promise<number> => 1;
    await cache.load(guildKey("g1"), loader);
    await cache.load(guildKey("g2"), loader);
    expect(cache.purgeScope(guildScope("g1"))).toBe(1);
    expect(cache.peek(guildKey("g1"))).toBeUndefined();
    expect(cache.peek(guildKey("g2"))).toBe(1);
  });

  test("a multi-scope entry is dropped by either tag", async () => {
    const cache = newCache();
    const key: CacheKey = { key: "g1|u1", scopes: [guildScope("g1"), userScope("u1")] };
    await cache.load(key, async () => 7);
    expect(cache.purgeScope(userScope("u1"))).toBe(1);
    expect(cache.peek(key)).toBeUndefined();
  });

  test("a write during an in-flight load is not overwritten by it", async () => {
    const cache = newCache();
    const key = guildKey("g1");
    let release: (value: number) => void = () => {};
    const pending = cache.load(key, () => new Promise<number>(resolve => (release = resolve)));
    cache.set(key, 99);
    release(1);
    await pending;
    expect(cache.peek(key)).toBe(99);
  });

  test("an approximate cache requires a ttl", () => {
    expect(() => new Cache({ name: "bad", mode: "approximate" })).toThrow(/must declare ttlMs/);
  });

  test("stats count hits and misses", async () => {
    const cache = newCache();
    const key = userKey("u1");
    await cache.load(key, async () => 1);
    await cache.load(key, async () => 1);
    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });
});
