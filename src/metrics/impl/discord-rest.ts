import { type Client } from "discord.js";
import { CounterMetric } from "../counter";
import { GaugeMetric } from "../gauge";
import { HistogramMetric } from "../histogram";
import { Metric, type MetricRegistration } from "../metric";

/**
 * A map metric keyed by a generalized Discord route such as
 * `/channels/:id/messages`. `request.route` is already ID-stripped by the
 * REST layer, so cardinality is bounded by the bot's command surface
 * rather than by guild or channel count.
 */
abstract class RouteMapMetric extends Metric<Record<string, number>> {
  // Nothing to self-collect: the map is whatever REST events have made it
  // so far when the exporter snapshots it. The interval only exists to
  // satisfy the manager's uniform collect loop.
  public override readonly collectIntervalMs: number = 60_000;
  private readonly values: Map<string, number> = new Map<string, number>();

  protected constructor(registration: MetricRegistration) {
    super(registration);
  }

  protected set(route: string, value: number): void {
    this.values.set(route, value);
  }

  protected current(route: string): number {
    return this.values.get(route) ?? 0;
  }

  public value(): Record<string, number> {
    return Object.fromEntries(this.values);
  }
}

/**
 * A {@link RouteMapMetric} that accumulates: each `increment` bumps one series.
 */
abstract class RouteCounterMetric extends RouteMapMetric {
  public increment(route: string): void {
    this.set(route, this.current(route) + 1);
  }
}

/**
 * REST requests since boot, one series per route: `rate()` per route is the call trend.
 */
export class RestRequestsMetric extends RouteCounterMetric {
  public constructor() {
    super({
      id: "discord_rest_requests_total",
      kind: "counter_map",
      label: "route",
      help: "Discord REST requests sent since boot, by route",
    });
  }
}

/**
 * REST responses with a 4xx/5xx status since boot, one series per route.
 * Divided by {@link RestRequestsMetric} this is the per-route error ratio.
 * Retries count again: the REST layer emits `response` for every attempt.
 */
export class RestErrorsMetric extends RouteCounterMetric {
  public constructor() {
    super({
      id: "discord_rest_errors_total",
      kind: "counter_map",
      label: "route",
      help: "Discord REST responses with an error status since boot, by route",
    });
  }
}

/**
 * Rate limit hits since boot, one series per route. Each is a request that
 * the REST layer had to park before sending, so a rising rate is real
 * backpressure rather than a warning.
 */
export class RestRateLimitsMetric extends RouteCounterMetric {
  public constructor() {
    super({
      id: "discord_rest_rate_limits_total",
      kind: "counter_map",
      label: "route",
      help: "Discord REST rate limit hits since boot, by route",
    });
  }
}

/**
 * Global rate limit hits since boot. The global bucket is process-wide, so
 * unlike the per-route limits this is a single series; any nonzero value
 * means the bot stalled every request, not just one route's.
 */
export class RestGlobalRateLimitsMetric extends CounterMetric {
  public override readonly collectIntervalMs: number = 60_000;

  public constructor() {
    super({
      id: "discord_rest_global_rate_limits_total",
      kind: "counter",
      help: "Discord REST global rate limit hits since boot",
    });
  }
}

/**
 * Rate limit buckets the REST manager is currently tracking. The REST layer
 * sweeps inactive buckets, so this settles at the working set size and a
 * sustained climb means buckets are being created faster than swept.
 */
export class RestBucketsMetric extends GaugeMetric {
  public override readonly collectIntervalMs: number = 30_000;
  private readonly client: Client;

  public constructor(client: Client) {
    super({
      id: "discord_rest_buckets",
      kind: "gauge",
      help: "Rate limit buckets the REST manager is tracking",
    });
    this.client = client;
  }

  public override collect(): void {
    this.set(this.client.rest.handlers.size);
  }
}

/**
 * Route hashes cached from past responses; the lookup table behind {@link RestBucketsMetric}.
 */
export class RestHashesMetric extends GaugeMetric {
  public override readonly collectIntervalMs: number = 30_000;
  private readonly client: Client;

  public constructor(client: Client) {
    super({ id: "discord_rest_hashes", kind: "gauge", help: "Route hashes the REST manager has cached" });
    this.client = client;
  }

  public override collect(): void {
    this.set(this.client.rest.hashes.size);
  }
}

/**
 * Requests left in the global bucket. Unlike the per-route buckets this one
 * is exposed directly by the REST manager, so it needs no header parsing.
 */
export class RestGlobalRemainingMetric extends GaugeMetric {
  public override readonly collectIntervalMs: number = 5_000;
  private readonly client: Client;

  public constructor(client: Client) {
    super({
      id: "discord_rest_global_remaining",
      kind: "gauge",
      help: "Requests remaining in the Discord REST global bucket",
    });
    this.client = client;
  }

  public override collect(): void {
    this.set(this.client.rest.globalRemaining);
  }
}

/**
 * Remaining requests reported by the last response for a route, read from
 * the `x-ratelimit-remaining` header. Discord keys buckets by route *and*
 * major parameter (channel, guild), so a route with many such parameters
 * has many buckets behind one series and this shows whichever was touched
 * last; it is a "is this route's limiter draining" signal, not a precise
 * per-bucket reading. Keying on the bucket hash instead would multiply the
 * series count by the bot's channel and guild count.
 */
export class RestBucketRemainingMetric extends RouteMapMetric {
  public constructor() {
    super({
      id: "discord_rest_bucket_remaining",
      kind: "counter_map",
      label: "route",
      help: "Requests remaining in the route's rate limit bucket, as of its last response",
    });
  }

  public record(route: string, remaining: number): void {
    this.set(route, remaining);
  }
}

/**
 * Bucket capacity reported by the last response for a route (`x-ratelimit-limit`).
 */
export class RestBucketLimitMetric extends RouteMapMetric {
  public constructor() {
    super({
      id: "discord_rest_bucket_limit",
      kind: "counter_map",
      label: "route",
      help: "Capacity of the route's rate limit bucket, as of its last response",
    });
  }

  public record(route: string, limit: number): void {
    this.set(route, limit);
  }
}

/**
 * REST round-trip time in milliseconds, timed around the manager's
 * `makeRequest` hook. Unlabeled: the exporter only adds `le` to a
 * histogram, so this is the distribution across all routes.
 */
export class RestRequestDurationMetric extends HistogramMetric {
  public override readonly collectIntervalMs: number = 60_000;

  public constructor() {
    super(
      {
        id: "discord_rest_request_duration_ms",
        kind: "histogram",
        help: "Discord REST round-trip time in milliseconds",
        unit: "ms",
      },
      // Millisecond bounds; the base default is in seconds and would leave
      // every request in the last bucket.
      [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    );
  }
}

/**
 * How long the REST layer parked a request when it hit a limiter, in
 * milliseconds. This is the backpressure the bot actually absorbed: it
 * rises before request volume itself becomes a problem.
 */
export class RestRateLimitWaitMetric extends HistogramMetric {
  public override readonly collectIntervalMs: number = 60_000;

  public constructor() {
    super(
      {
        id: "discord_rest_rate_limit_wait_ms",
        kind: "histogram",
        help: "Time requests spent waiting on a rate limit, in milliseconds",
        unit: "ms",
      },
      [100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000]
    );
  }
}

/**
 * Invalid requests in Discord's 10 minute window, from the REST layer's
 * warning event (emitted at 500, 1000, ... by default). A climb means
 * Discord is rejecting a growing share of calls, usually a permission or
 * payload bug rather than volume.
 */
export class RestInvalidRequestsMetric extends GaugeMetric {
  public override readonly collectIntervalMs: number = 60_000;

  public constructor() {
    super({
      id: "discord_rest_invalid_requests",
      kind: "gauge",
      help: "Invalid Discord REST requests in the current window",
    });
  }
}
