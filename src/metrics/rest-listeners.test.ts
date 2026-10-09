import { describe, expect, setSystemTime, test } from "bun:test";
import { RESTEvents, type Client } from "discord.js";
import { RestListeners } from "./rest-listeners";

type Listener = (...args: never[]) => void;

/**
 * A stand-in for `client.rest`: the same emitter surface (`on`), the
 * mutable `options.makeRequest` hook, and the three public collections the
 * listener's gauges read. Cast to `Client` at the call site.
 */
class FakeRest {
  public readonly options: { makeRequest: (url: string, init: RequestInit) => Promise<unknown> };
  public readonly handlers: Set<string> = new Set<string>();
  public readonly hashes: Set<string> = new Set<string>();
  public globalRemaining: number = 50;
  private readonly listeners: Map<string, Listener[]> = new Map<string, Listener[]>();

  public constructor() {
    this.options = { makeRequest: async () => ({ status: 200, headers: new Headers() }) };
  }

  public on(event: string, listener: Listener): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
    return this;
  }

  public emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      (listener as (...a: unknown[]) => void)(...args);
    }
  }
}

function harness(): { rest: FakeRest; listeners: RestListeners } {
  const rest = new FakeRest();
  const listeners = new RestListeners({ rest } as unknown as Client);
  return { rest, listeners };
}

function response(
  status: number,
  headers: Record<string, string> = {}
): { status: number; headers: Headers } {
  return { status, headers: new Headers(headers) };
}

describe("RestListeners", () => {
  test("counts requests and errors by generalized route", () => {
    const { rest, listeners } = harness();
    rest.emit(RESTEvents.Response, { route: "/channels/:id/messages" }, response(200));
    rest.emit(RESTEvents.Response, { route: "/channels/:id/messages" }, response(200));
    rest.emit(RESTEvents.Response, { route: "/channels/:id/messages" }, response(403));

    expect(listeners.requests.value()).toEqual({ "/channels/:id/messages": 3 });
    expect(listeners.errors.value()).toEqual({ "/channels/:id/messages": 1 });
  });

  test("reads bucket state from the rate limit headers", () => {
    const { rest, listeners } = harness();
    rest.emit(
      RESTEvents.Response,
      { route: "/channels/:id/messages" },
      response(200, { "x-ratelimit-remaining": "3", "x-ratelimit-limit": "5" })
    );

    expect(listeners.bucketRemaining.value()).toEqual({ "/channels/:id/messages": 3 });
    expect(listeners.bucketLimit.value()).toEqual({ "/channels/:id/messages": 5 });
  });

  test("ignores responses without rate limit headers", () => {
    const { rest, listeners } = harness();
    rest.emit(RESTEvents.Response, { route: "/gateway/bot" }, response(200));

    expect(listeners.bucketRemaining.value()).toEqual({});
    expect(listeners.bucketLimit.value()).toEqual({});
  });

  test("ignores an unparseable rate limit header", () => {
    const { rest, listeners } = harness();
    rest.emit(
      RESTEvents.Response,
      { route: "/gateway/bot" },
      response(200, { "x-ratelimit-remaining": "unknown" })
    );

    expect(listeners.bucketRemaining.value()).toEqual({});
  });

  test("drops a bucket reading once the route has been quiet for the stale window", () => {
    const { rest, listeners } = harness();
    rest.emit(
      RESTEvents.Response,
      { route: "/channels/:id/messages" },
      response(200, { "x-ratelimit-remaining": "3", "x-ratelimit-limit": "5" })
    );

    try {
      setSystemTime(Date.now() + 6 * 60_000);
      listeners.bucketRemaining.collect();
      listeners.bucketLimit.collect();

      expect(listeners.bucketRemaining.value()).toEqual({});
      expect(listeners.bucketLimit.value()).toEqual({});
    } finally {
      setSystemTime();
    }
  });

  test("keeps a refreshed bucket reading, and keeps route counters, past the stale window", () => {
    const { rest, listeners } = harness();
    rest.emit(
      RESTEvents.Response,
      { route: "/channels/:id/messages" },
      response(200, { "x-ratelimit-remaining": "3", "x-ratelimit-limit": "5" })
    );

    try {
      setSystemTime(Date.now() + 4 * 60_000);
      rest.emit(
        RESTEvents.Response,
        { route: "/channels/:id/messages" },
        response(200, { "x-ratelimit-remaining": "4", "x-ratelimit-limit": "5" })
      );

      setSystemTime(Date.now() + 4 * 60_000);
      listeners.bucketRemaining.collect();

      expect(listeners.bucketRemaining.value()).toEqual({ "/channels/:id/messages": 4 });
      expect(listeners.requests.value()).toEqual({ "/channels/:id/messages": 2 });
    } finally {
      setSystemTime();
    }
  });

  test("counts rate limit hits, global hits separately, and waits", () => {
    const { rest, listeners } = harness();
    rest.emit(RESTEvents.RateLimited, { route: "/channels/:id/messages", global: false, retryAfter: 250 });
    rest.emit(RESTEvents.RateLimited, { route: "/channels/:id/messages", global: false, retryAfter: 1000 });
    rest.emit(RESTEvents.RateLimited, { route: "/channels/:id/messages", global: true, retryAfter: 5000 });

    expect(listeners.rateLimits.value()).toEqual({ "/channels/:id/messages": 3 });
    expect(listeners.globalRateLimits.value()).toBe(1);
    expect(listeners.rateLimitWait.value().count).toBe(3);
    expect(listeners.rateLimitWait.value().sum).toBe(6250);
  });

  test("records the invalid request count from the warning", () => {
    const { rest, listeners } = harness();
    rest.emit(RESTEvents.InvalidRequestWarning, { count: 500, remainingTime: 1000 });

    expect(listeners.invalidRequests.value()).toBe(500);
  });

  test("times the transport through the makeRequest hook", async () => {
    const { rest, listeners } = harness();
    await rest.options.makeRequest("https://discord.com/api/v10/gateway/bot", {});

    const value = listeners.duration.value();
    expect(value.count).toBe(1);
    expect(value.sum).toBeGreaterThanOrEqual(0);
  });

  test("reads the bucket, hash and global gauges from the REST manager", () => {
    const { rest, listeners } = harness();
    rest.handlers.add("a:1");
    rest.handlers.add("a:2");
    rest.hashes.add("GET:/channels/:id/messages");
    rest.globalRemaining = 41;

    listeners.buckets.collect();
    listeners.hashes.collect();
    listeners.globalRemaining.collect();

    expect(listeners.buckets.value()).toBe(2);
    expect(listeners.hashes.value()).toBe(1);
    expect(listeners.globalRemaining.value()).toBe(41);
  });
});
