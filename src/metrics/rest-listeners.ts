import { RESTEvents, type Client } from "discord.js";
import {
  RestBucketLimitMetric,
  RestBucketRemainingMetric,
  RestBucketsMetric,
  RestErrorsMetric,
  RestGlobalRateLimitsMetric,
  RestGlobalRemainingMetric,
  RestHashesMetric,
  RestInvalidRequestsMetric,
  RestRateLimitsMetric,
  RestRateLimitWaitMetric,
  RestRequestDurationMetric,
  RestRequestsMetric,
} from "./impl/discord-rest";
import type { Metric } from "./metric";

/**
 * Instruments the discord.js REST manager. Every metric here is fed by the
 * `@discordjs/rest` emitter on `client.rest`, not by the gateway, so this
 * attaches directly instead of going through `EventBridge`.
 *
 * The `response` listener also switches that event on: the REST layer only
 * emits it when something is subscribed (`listenerCount("response")`), so
 * without one there would be no request volume or rate limit headers to read.
 */
export class RestListeners {
  public readonly requests: RestRequestsMetric = new RestRequestsMetric();
  public readonly errors: RestErrorsMetric = new RestErrorsMetric();
  public readonly rateLimits: RestRateLimitsMetric = new RestRateLimitsMetric();
  public readonly globalRateLimits: RestGlobalRateLimitsMetric = new RestGlobalRateLimitsMetric();
  public readonly bucketRemaining: RestBucketRemainingMetric = new RestBucketRemainingMetric();
  public readonly bucketLimit: RestBucketLimitMetric = new RestBucketLimitMetric();
  public readonly duration: RestRequestDurationMetric = new RestRequestDurationMetric();
  public readonly rateLimitWait: RestRateLimitWaitMetric = new RestRateLimitWaitMetric();
  public readonly invalidRequests: RestInvalidRequestsMetric = new RestInvalidRequestsMetric();
  public readonly buckets: RestBucketsMetric;
  public readonly hashes: RestHashesMetric;
  public readonly globalRemaining: RestGlobalRemainingMetric;

  public constructor(client: Client) {
    this.buckets = new RestBucketsMetric(client);
    this.hashes = new RestHashesMetric(client);
    this.globalRemaining = new RestGlobalRemainingMetric(client);
    this.instrumentMakeRequest(client);
    this.attachRestEvents(client);
  }

  /** Every metric this listener feeds, so registration stays a single pass. */
  public get metrics(): Metric<any>[] {
    return [
      this.requests,
      this.errors,
      this.rateLimits,
      this.globalRateLimits,
      this.buckets,
      this.hashes,
      this.globalRemaining,
      this.bucketRemaining,
      this.bucketLimit,
      this.duration,
      this.rateLimitWait,
      this.invalidRequests,
    ];
  }

  /**
   * Time the transport itself. `response` carries no duration, and the
   * manager exposes `makeRequest` as its documented override point (it
   * defaults to `fetch`), so wrapping it is the only place a round-trip
   * can be timed from end to end.
   */
  private instrumentMakeRequest(client: Client): void {
    const makeRequest = client.rest.options.makeRequest;
    client.rest.options.makeRequest = async (url, init) => {
      const start = performance.now();
      try {
        return await makeRequest(url, init);
      } finally {
        this.duration.observe(performance.now() - start);
      }
    };
  }

  private attachRestEvents(client: Client): void {
    client.rest.on(RESTEvents.Response, (request, response) => {
      this.requests.increment(request.route);
      if (response.status >= 400) {
        this.errors.increment(request.route);
      }
      const remaining = headerNumber(response.headers, "x-ratelimit-remaining");
      if (remaining !== null) {
        this.bucketRemaining.record(request.route, remaining);
      }
      const limit = headerNumber(response.headers, "x-ratelimit-limit");
      if (limit !== null) {
        this.bucketLimit.record(request.route, limit);
      }
    });

    client.rest.on(RESTEvents.RateLimited, info => {
      this.rateLimits.increment(info.route);
      if (info.global) {
        this.globalRateLimits.increment();
      }
      this.rateLimitWait.observe(info.retryAfter);
    });

    client.rest.on(RESTEvents.InvalidRequestWarning, info => {
      this.invalidRequests.set(info.count);
    });
  }
}

/** Read a numeric `x-ratelimit-*` header, or null when absent or unparseable. */
function headerNumber(headers: { get(name: string): string | null }, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
