import { LRUCache } from "lru-cache";
import type { CacheKey, ScopeTag } from "./key";

/**
 * How a cache stays correct.
 *
 * - `authoritative` caches hold data that must never be stale: settings,
 *   permissions, user rows. Correctness comes from invalidating on every
 *   write path. A TTL is a safety net only, not the mechanism.
 * - `approximate` caches tolerate bounded staleness: leaderboard pages,
 *   aggregates. Correctness comes from the TTL, and nothing invalidates them.
 */
export type CacheMode = "authoritative" | "approximate";

export interface CacheOptions {
  /** Registry name, and the label used by the cache metrics. */
  name: string;
  mode: CacheMode;
  /** Entry cap. Defaults to 10_000. */
  max?: number;
  /**
   * Expiry in milliseconds. Required for `approximate`, where it is what
   * keeps the cache correct; optional for `authoritative`, where it only
   * guards against a writer outside this process.
   */
  ttlMs?: number;
}

export interface CacheStats {
  name: string;
  mode: CacheMode;
  size: number;
  hits: number;
  misses: number;
}

/**
 * A scope-aware cache in front of a loader, built on `lru-cache`.
 *
 * Values are boxed so a cached `null` (a meaningful negative result, e.g.
 * "this guild has no stored setting") is a hit, not a miss. Loads stamp the
 * cache only if nothing wrote the same scope while the load was in flight,
 * so an in-flight read can never resurrect an entry a write just dropped.
 * Concurrent misses for the same key share one load, unless a write landed
 * since that load started (its result would already be stale).
 */
export class Cache<V> {
  public readonly name: string;
  public readonly mode: CacheMode;

  private readonly store: LRUCache<string, { value: V; scopes: readonly ScopeTag[] }>;
  /** Bumped per scope on every mutation; in-flight loads compare against it. */
  private readonly generations: Map<ScopeTag, number> = new Map<ScopeTag, number>();
  private readonly inflight: Map<string, { generation: number; promise: Promise<V> }> = new Map();
  // Bumped by `clear`, which has no scope to tag.
  private epoch: number = 0;
  private hits: number = 0;
  private misses: number = 0;

  public constructor(options: CacheOptions) {
    if (options.mode === "approximate" && options.ttlMs === undefined) {
      throw new Error(`Approximate cache "${options.name}" must declare ttlMs`);
    }
    this.name = options.name;
    this.mode = options.mode;
    this.store = new LRUCache({
      max: options.max ?? 10_000,
      ttl: options.ttlMs,
      updateAgeOnGet: options.mode === "approximate",
    });
  }

  /**
   * Read through the cache, loading on a miss. Concurrent misses for the
   * same key share one loader call; different keys load in parallel.
   */
  public async load(key: CacheKey, loader: () => Promise<V>): Promise<V> {
    const existing = this.store.get(key.key);
    if (existing !== undefined) {
      this.hits++;
      return existing.value;
    }
    this.misses++;
    const generation = this.generationForScopes(key.scopes);
    const pending = this.inflight.get(key.key);
    if (pending?.generation === generation) {
      return pending.promise;
    }
    const entry = { generation, promise: this.runLoad(key, loader, generation) };
    this.inflight.set(key.key, entry);
    try {
      return await entry.promise;
    } finally {
      if (this.inflight.get(key.key) === entry) {
        this.inflight.delete(key.key);
      }
    }
  }

  private async runLoad(key: CacheKey, loader: () => Promise<V>, generation: number): Promise<V> {
    const value = await loader();
    if (this.generationForScopes(key.scopes) === generation) {
      this.store.set(key.key, { value, scopes: key.scopes });
    }
    return value;
  }

  public peek(key: CacheKey): V | undefined {
    return this.store.get(key.key, { updateAgeOnGet: false })?.value;
  }

  public set(key: CacheKey, value: V): void {
    this.bumpScopes(key.scopes);
    this.store.set(key.key, { value, scopes: key.scopes });
  }

  public invalidate(key: CacheKey): void {
    this.bumpScopes(key.scopes);
    this.store.delete(key.key);
  }

  /**
   * Drop every entry tagged with `scope`. Walks the entries, so callers
   * must be lifecycle operations (guild left, user erased), never hot paths.
   */
  public purgeScope(scope: ScopeTag): number {
    this.bumpScopes([scope]);
    let purged = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.scopes.includes(scope)) {
        this.store.delete(key);
        purged++;
      }
    }
    return purged;
  }

  public clear(): void {
    this.epoch++;
    this.store.clear();
  }

  public stats(): CacheStats {
    return {
      name: this.name,
      mode: this.mode,
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
    };
  }

  private generationForScopes(scopes: readonly ScopeTag[]): number {
    let total = this.epoch;
    for (const scope of scopes) {
      total += this.generations.get(scope) ?? 0;
    }
    return total;
  }

  private bumpScopes(scopes: readonly ScopeTag[]): void {
    for (const scope of scopes) {
      this.generations.set(scope, (this.generations.get(scope) ?? 0) + 1);
    }
  }
}
