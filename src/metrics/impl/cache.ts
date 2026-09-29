import { Caches } from "@/cache/index";
import { Metric } from "../metric";

/**
 * Cache size and effectiveness, one series per cache and measure:
 * `<cache>:<hits|misses|size>` under the `cache` label.
 *
 * `size` is the live entry count, so it shows occupancy directly and a cache
 * pinned at its `max` is evicting. `hits`/`misses` are cumulative since boot,
 * so hit rate is
 * `rate(cache_entries{cache="x:hits"}[5m]) / (rate(...hits[5m]) + rate(...misses[5m]))`.
 * A cache with a poor hit rate is not earning its memory.
 */
export class CacheMetricsMetric extends Metric<Record<string, number>> {
  // Nothing to self-collect: the registry is read at snapshot time.
  public override readonly collectIntervalMs = 30_000;

  public constructor() {
    super({
      id: "cache_entries",
      kind: "counter_map",
      label: "cache",
      help: "Cache hits, misses and size by cache",
    });
  }

  public value(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const stats of Caches.stats()) {
      out[`${stats.name}:hits`] = stats.hits;
      out[`${stats.name}:misses`] = stats.misses;
      out[`${stats.name}:size`] = stats.size;
    }
    return out;
  }
}
