# Metrics System Plan

A push-based metrics system for Shiroko, exporting bot health and activity
counters to a [VictoriaMetrics](https://victoriametrics.com/) single-node
instance via the Prometheus text exposition format on the import endpoint.
Values are collected in-process, buffered, and pushed to the VM endpoint
over HTTP on an interval. The dashboard side (Grafana or VMUI) is out of
scope; this plan covers the in-process registry, metric types, collectors,
and the exporter.

## 1. Goals and non-goals

**Goals**

- Instrument the bot with a small, typed metric registry: gauges, a
  histogram, and an event counter map, with per-metric metadata (help
  text, units).
- Collect a fixed set of health metrics (see §5) in-process without
  blocking the event loop.
- Push them to VictoriaMetrics on a fixed interval with resilient
  failure handling (log and retry next interval, never crash).

**Non-goals**

- No feature IDs: metrics are global to the bot, not per-feature. The
  registry has no integration with `GuildFeatures`.
- No pull-based scraping (`/metrics` HTTP endpoint). Push-only.
- No metric persistence, no snapshots across restarts.
- No per-guild or per-user metric dimensions yet. If per-guild breakdowns
  are needed later, they become label sets on a new metric subclass, not
  a second registry.

## 2. Registry design

The registry is a keyed store of metric instances. Each metric is a class
in `src/metrics/impl/` that extends a base metric type and owns itself (its
registration and its `collect()` method); an instance of each lives in the
`metrics` object in `src/metrics/metrics.ts` and is registered once at
boot via `MetricManager.register`. The manager holds the instances only so
the exporter can `snapshot()` them; there is no lookup-by-id API because
callers hold the instances directly.

```ts
const gauge = new GaugeMetric({ id: "guilds", kind: "gauge", help: "Guilds the bot is in" });
manager.register(gauge);
```

### Files

| File           | Contents                                                     |
| -------------- | ------------------------------------------------------------ |
| `metric.ts`    | `Metric<T>` base, `MetricKind`, `MetricRegistration`         |
| `gauge.ts`     | `GaugeMetric` (single numeric value)                         |
| `counter.ts`   | `CounterMetric` (single monotonic total)                     |
| `histogram.ts` | `HistogramMetric` (bucket-based), `HistogramValue`           |
| `index.ts`     | `MetricManager` (registry + collection wiring)               |
| `impl/`        | One metric-owning class per metric (see §6)                  |
| `exporter.ts`  | `VictoriaMetricsExporter` (push transport + text serializer) |
| `errors.ts`    | `DuplicateMetricError`                                       |

## 3. Metric types

### Base

`Metric<T>` is generic over the held value: a number for gauges or a
histogram value.

```ts
export abstract class Metric<T = unknown> {
  public readonly id: string;
  public readonly kind: MetricKind;
  public readonly help: string;
  public readonly unit?: string;

  protected constructor(registration: MetricRegistration) { ... }

  public abstract value(): T;
}
```

### Gauge

```ts
export class GaugeMetric extends Metric<number> {
  public set(value: number): void {
    this.current = value;
  }
  public value(): number {
    return this.current;
  }
}
```

### Counter map

Monotonic, event-driven, but one metric with many series: the value is a
map of event key to cumulative count, each key serialized as its own
series under the same id with an `event` label. Events are added by
extending the `DiscordEventName` union plus one handler in
`EventVolumeListeners`; no new metric class or registration line. Only
high-volume raw Discord gateway events are counted (load trends, per
sec); rare admin events (role edits, invites) and bot-derived events
(voice sessions) are excluded.

```ts
export type DiscordEventName =
  "messages" | "member_joins" | "presence_changes" | "slash_commands" | "context_menus" | "components";

export class DiscordEventsMetric extends Metric<Record<string, number>> {
  public increment(event: DiscordEventName, by = 1): void {
    this.counts.set(event, (this.counts.get(event) ?? 0) + by);
  }
  public value(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}
```

Series ids carry the Prometheus `_total` suffix (e.g.
`discord_events_total`), and the `event` label splits the map into series:

```
discord_events_total{event="messages",job="arona"} 123
discord_events_total{event="slash_commands",job="arona"} 45
```

so the dashboard can `rate(discord_events_total{event="messages"}[5m])`
for per-event per-second rates.

### Histogram

Buckets are fixed at construction; `observe` mantains cumulative bucket
counts plus total sum and count.

```ts
export class HistogramMetric extends Metric<HistogramValue> {
  public observe(value: number): void { ... }
  public value(): HistogramValue {
    return { buckets: this.buckets, counts: this.counts, sum: this.total, count: this.count };
  }
}

export interface HistogramValue {
  readonly buckets: readonly number[];
  readonly counts: readonly number[];
  readonly sum: number;
  readonly count: number;
}
```

## 4. Push protocol

VictoriaMetrics accepts the Prometheus text exposition format on `POST
/api/v1/import/prometheus`. The exporter:

1. **Serializes** each metric to one text line: `name{labels} value`,
   with histograms expanded to `_bucket{le}` (cumulative), `_sum` and
   `_count`. The timestamp is omitted, so VM stamps ingestion time.
2. **Posts** the body to `VM_PUSH_URL` with `Content-Type: text/plain`.

The serializer lives inside `exporter.ts` and is a few lines of string
formatting; no snappy, no protobuf, and the body is human-readable for
debugging.

```ts
// src/index.ts
const exporter = new VictoriaMetricsExporter(metricManager, {
  url: env.VM_PUSH_URL,
  job: Constants.botName,
  intervalMs: Number(env.VM_PUSH_INTERVAL_MS ?? 60_000),
});
exporter.start();
```

### Snapshot shape

The manager exposes `snapshot()` (id + kind + `value()`) so the exporter
stays transport-only:

```ts
export interface MetricSnapshot {
  readonly id: string;
  readonly kind: MetricKind;
  readonly value: unknown;
}
```

### Failure handling

- The push is one HTTP call per interval with the whole text body.
- No retry queue: an error is logged, the next interval pushes fresh
  values. Metrics are read-only during serialization, so a failed push
  never corrupts the registry.

## 5. Required metrics

| Metric                 | Type        | Source                                        |
| ---------------------- | ----------- | --------------------------------------------- |
| `guilds`               | gauge       | `client.guilds.cache.size`                    |
| `seen_users`           | gauge       | `COUNT(*)` over `global_users`                |
| `process_ram_used`     | gauge       | `process.memoryUsage().rss` (bytes)           |
| `process_ram_total`    | gauge       | `getHeapStatistics().heap_size_limit` (bytes) |
| `process_cpu_usage`    | gauge       | `process.cpuUsage()` delta (percent)          |
| `gateway_latency_ms`   | gauge       | `client.ws.ping`                              |
| `uptime_seconds`       | gauge       | `process.uptime()`                            |
| `event_loop_ms`        | histogram   | loop-slip measurement (see §6)                |
| `discord_events_total` | counter_map | bus events (see §6)                           |

The Discord REST metrics (`discord_rest_*`) are documented in §6.1.

`discord_events_total` accumulates since boot with an `event` label per
kind; the dashboard renders per-event per-second rates via PromQL
`rate(discord_events_total{event="..."}[5m])`.

All metrics carry the fixed label `job` (bot name). No feature ids.

## 6. Metrics (impl/)

Each metric is a class in its own file under `src/metrics/impl/`, extending
its base metric type. The class owns the metric: it hardcodes the
registration (id, kind, help, unit) in the constructor, declares its own
collection cadence (`collectIntervalMs`) and implements `collect()` to read
the live value and update itself. Registration is one `manager.register(...)`
line in `src/index.ts` (see §8); the manager picks up every registered
metric automatically via `MetricManager.all()`, so adding a metric touches
only its impl file and that one registration line.

| File                   | Class                   | Source                         |
| ---------------------- | ----------------------- | ------------------------------ |
| `guild-count.ts`       | `GuildsMetric`          | `client.guilds.cache.size`     |
| `seen-users.ts`        | `SeenUsersMetric`       | `COUNT(*)` over `global_users` |
| `process-ram-used.ts`  | `ProcessRamUsedMetric`  | `process.memoryUsage().rss`    |
| `process-ram-total.ts` | `ProcessRamTotalMetric` | `os.totalmem()` (MiB)          |
| `cpu-usage.ts`         | `ProcessCpuUsageMetric` | `process.cpuUsage()` delta     |
| `gateway-latency.ts`   | `GatewayLatencyMetric`  | `client.ws.ping`               |
| `uptime-seconds.ts`    | `UptimeMetric`          | `process.uptime()`             |
| `event-loop-delay.ts`  | `EventLoopMetric`       | loop-slip measurement          |
| `discord-events.ts`    | `DiscordEventsMetric`   | bus events (see below)         |
| `discord-rest.ts`      | `Rest*Metric` (12)      | `client.rest` (see §6.1)       |

`DiscordEventsMetric` is event-driven: it declares a placeholder
`collectIntervalMs` (it has nothing to self-collect) and is bumped by
`EventVolumeListeners` in `event-volume-listeners.ts`, which subscribes
on the bus to the high-volume raw gateway events only:
`MessageCreatedEvent`, `MemberGuildJoinEvent`, `UserPresenceChangedEvent`,
`SlashCommandReceivedEvent`, `ContextMenuReceivedEvent`, and
`ComponentReceivedEvent`.

### 6.1 Discord REST metrics

`RestListeners` (in `src/metrics/rest-listeners.ts`) instruments the
discord.js REST manager. These metrics come from `@discordjs/rest`, not
the gateway, so the listeners attach to `client.rest` directly instead of
going through `EventBridge`. The listener owns its metrics (they exist
only to be fed by REST events) and exposes them as `listeners.metrics`,
which `src/index.ts` registers in one pass.

| Metric                                  | Type        | Source                         |
| --------------------------------------- | ----------- | ------------------------------ |
| `discord_rest_requests_total`           | counter_map | `response` event               |
| `discord_rest_errors_total`             | counter_map | `response` (status >= 400)     |
| `discord_rest_rate_limits_total`        | counter_map | `rateLimited` event            |
| `discord_rest_global_rate_limits_total` | counter     | `rateLimited` (`global: true`) |
| `discord_rest_buckets`                  | gauge       | `client.rest.handlers.size`    |
| `discord_rest_hashes`                   | gauge       | `client.rest.hashes.size`      |
| `discord_rest_global_remaining`         | gauge       | `client.rest.globalRemaining`  |
| `discord_rest_bucket_remaining`         | counter_map | `x-ratelimit-remaining` header |
| `discord_rest_bucket_limit`             | counter_map | `x-ratelimit-limit` header     |
| `discord_rest_request_duration_ms`      | histogram   | `makeRequest` hook             |
| `discord_rest_rate_limit_wait_ms`       | histogram   | `rateLimited.retryAfter`       |
| `discord_rest_invalid_requests`         | gauge       | `invalidRequestWarning` event  |

The route-keyed series use `request.route`, the REST layer's
already-ID-stripped bucket route (`/channels/:id/messages`), so cardinality
is bounded by the command surface rather than by guild or channel count.
`discord_rest_bucket_remaining`/`_limit` are keyed the same way rather than
by Discord's bucket hash: a hash is per route _and_ major parameter, so
keying on it would add a series per channel and guild. Because those two
carry the last reading rather than a total, a route that goes 5 minutes
without a call is dropped from the map on the next collect, so the exporter
stops pushing a frozen value for a route that is no longer being called.
The route counters keep their keys: pruning one would read as a reset.

Two constraints of the current subsystem shape this: a `counter_map`
carries exactly one label (so status gets its own metric, and method is
not dimensioned), and the exporter emits histograms unlabeled (only `le`),
so both histograms are process-wide distributions rather than per-route.

Timing REST round-trips needs the `makeRequest` hook because the `response`
event carries no duration; `rest.options.makeRequest` is the REST layer's
documented override point (it defaults to `fetch`). Note that attaching a
`response` listener is also what makes the REST layer emit that event at
all (`listenerCount("response")`), so the volume counters exist only while
`RestListeners` is constructed.

`MetricManager` (in `src/metrics/index.ts`) extends `EventListener`, the
`SettingsManager` pattern: it subscribes to the bus in its constructor and
its `@EventHandler(BotReadyEvent)` iterates every registered metric, runs
`collect()` immediately, and starts a `setInterval` of
`collectIntervalMs` per metric: guilds/ram/cpu/gateway/uptime at 5s, seen
users at 60s, event loop at 1s.

## 7. Env/config

Added to `src/lib/env.ts` (all optional):

| Variable              | Default     | Meaning                                                                 |
| --------------------- | ----------- | ----------------------------------------------------------------------- |
| `VM_PUSH_URL`         | unset (off) | VictoriaMetrics base URL (exporter appends `/api/v1/import/prometheus`) |
| `VM_PUSH_INTERVAL_MS` | `60000`     | Push cadence for the exporter                                           |

The `job` label comes from the static `Constants.botName` ("arona"),
not an env var.

The exporter is guarded in `src/index.ts`: if `VM_PUSH_URL` is absent,
metrics are still collected and registered but no HTTP traffic is sent,
keeping the bot runnable in dev without a VM instance.

## 8. Wiring in `src/index.ts`

```ts
const metricManager = new MetricManager(); // listens for BotReadyEvent

metricManager.register(new GuildsMetric(discordClient));
metricManager.register(new GatewayLatencyMetric(discordClient));
metricManager.register(new SeenUsersMetric());
// ... one register() per metric

if (env.VM_PUSH_URL) {
  const exporter = new VictoriaMetricsExporter(metricManager, {
    url: env.VM_PUSH_URL,
    job: Constants.botName,
    intervalMs: Number(env.VM_PUSH_INTERVAL_MS ?? 60_000),
  });
  exporter.start();
}
```

## 9. Serialization example (what VM receives)

```
# TYPE guilds gauge
guilds{job="arona"} 14
# TYPE process_ram_used gauge
process_ram_used{job="arona"} 184400000
# TYPE event_loop_ms histogram
event_loop_ms_bucket{le="0.05",job="arona"} 3
event_loop_ms_bucket{le="0.1",job="arona"} 4
event_loop_ms_bucket{le="+Inf",job="arona"} 4
event_loop_ms_sum{job="arona"} 0.220
event_loop_ms_count{job="arona"} 4
```

## 10. Testing

The subsystem ships with headless tests (no VM, no network): `exporter.test.ts`
stubs `fetch` to assert the text exposition format, `histogram.test.ts` pins
the per-bucket counting, and `rest-listeners.test.ts` drives a stand-in REST
emitter to check every `discord_rest_*` metric without a real client.
Type-checking (`bunx tsc --noEmit`) still catches wrong metric classes at the
branded-id call sites.

## 11. Rollout

1. Land `src/metrics/` (registry + types + collectors) with tests.
2. Land the exporter behind `VM_PUSH_URL`; run dev pushes in the terminal
   against a local VM container, verify in VMUI.
3. Add the dashboard queries in Grafana (out of scope for this plan).
