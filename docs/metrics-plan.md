# Metrics System Plan

A push-based metrics system for Shiroko, exporting bot health and activity
counters to a [VictoriaMetrics](https://victoriametrics.com/) single-node
instance via the Prometheus remote-write protocol. Values are collected
in-process, buffered, and pushed to the VM endpoint over HTTP in batches.
The dashboard side (Grafana or VMUI) is out of scope; this plan covers the
in-process registry, metric types, collectors, and the exporter.

## 1. Goals and non-goals

**Goals**

- Instrument the bot with a small, typed metric registry: gauges and a
  histogram, with per-metric metadata (help text, units).
- Collect a fixed set of health metrics (see §5) in-process without
  blocking the event loop.
- Push them to VictoriaMetrics on a fixed interval with chunked batching
  and resilient failure handling (log and retry next interval, never
  crash).

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
const gauge = new GaugeMetric({ id: "shiroko_guilds", kind: "gauge", help: "Guilds the bot is in" });
manager.register(gauge);
```

### Files

| File              | Contents                                             |
| ----------------- | ---------------------------------------------------- |
| `metric.ts`       | `Metric<T>` base, `MetricKind`, `MetricRegistration` |
| `gauge.ts`        | `GaugeMetric` (single numeric value)                 |
| `histogram.ts`    | `HistogramMetric` (bucket-based), `HistogramValue`   |
| `index.ts`        | `MetricManager` (registry + collection wiring)       |
| `impl/`           | One metric-owning class per metric (see §6)          |
| `exporter.ts`     | `VictoriaMetricsExporter` (push transport)           |
| `remote-write.ts` | Protobuf + snappy encoder for the push payload       |
| `errors.ts`       | `DuplicateMetricError`                               |

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

VictoriaMetrics accepts the Prometheus remote-write protocol (`PUT
/api/v1/write`) with a snappy-compressed protobuf body. The exporter:

1. **Serializes** each metric into prompb `TimeSeries` (metric name as
   `__name__`, labels incl. `job`/`instance`, one `Sample`), then encodes a
   `WriteRequest`.
2. **Compresses** with `snappyjs`.
3. **Posts** to `VM_PUSH_URL` with `Content-Encoding: snappy`.

The tiny protobuf encoder in `remote-write.ts` covers exactly the fields
VictoriaMetrics needs (`Label`, `Sample`, `TimeSeries`, `WriteRequest`), so
no protobuf dependency is required.

```ts
// src/index.ts
const exporter = new VictoriaMetricsExporter(metricManager, {
  url: env.VM_PUSH_URL,
  job: env.BOT_NAME ?? "shiroko",
  instance: os.hostname(),
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

### Batching & failure handling

- The push is one HTTP call per interval for all metrics; payloads larger
  than `maxBatchBytes` (default 1 MB) are chunked into separate requests.
- No retry queue: an error is logged, the next interval pushes fresh
  values. Metrics are read-only during serialization, so a failed push
  never corrupts the registry.

## 5. Required metrics

| Metric                       | Type      | Source                               |
| ---------------------------- | --------- | ------------------------------------ |
| `shiroko_guilds`             | gauge     | `client.guilds.cache.size`           |
| `shiroko_seen_users`         | gauge     | `COUNT(*)` over `global_users`       |
| `shiroko_process_ram_used`   | gauge     | `process.memoryUsage().rss` (MiB)    |
| `shiroko_process_ram_total`  | gauge     | `os.totalmem()` (MiB)                |
| `shiroko_process_cpu_usage`  | gauge     | `process.cpuUsage()` delta (percent) |
| `shiroko_gateway_latency_ms` | gauge     | `client.ws.ping`                     |
| `shiroko_uptime_seconds`     | gauge     | `process.uptime()`                   |
| `shiroko_event_loop_ms`      | histogram | loop-slip measurement (see §6)       |

All metrics carry the fixed labels `job` (bot name) and `instance` (host
name). No feature ids.

## 6. Metrics (impl/)

Each metric is a class in its own file under `src/metrics/impl/`, extending
its base metric type. The class owns the metric: it hardcodes the
registration (id, kind, help, unit) in the constructor, declares its own
collection cadence (`collectIntervalMs`) and implements `collect()` to read
the live value and update itself. Registration is one `manager.register(...)`
line in `src/index.ts` (see §8); the manager picks up every registered
metric automatically via `MetricManager.all()`, so adding a metric touches
only its impl file and that one registration line.

| File                     | Class                   | Source                             |
| ------------------------ | ----------------------- | ---------------------------------- |
| `guild-count.ts`         | `GuildsMetric`          | `client.guilds.cache.size`         |
| `seen-users.ts`          | `SeenUsersMetric`       | `COUNT(*)` over `global_users`     |
| `process-ram-used.ts`    | `ProcessRamUsedMetric`  | `process.memoryUsage().rss` (MiB)  |
| `process-ram-total.ts`   | `ProcessRamTotalMetric` | `os.totalmem()` (MiB)              |
| `cpu-usage.ts`           | `ProcessCpuUsageMetric` | `process.cpuUsage()` delta, 0-100% |
| `gateway-latency.ts`     | `GatewayLatencyMetric`  | `client.ws.ping`                   |
| `uptime-seconds.ts`      | `UptimeMetric`          | `process.uptime()`                 |
| `event-loop-delay.ts`    | `EventLoopMetric`       | loop-slip measurement              |

`MetricManager` (in `src/metrics/index.ts`) extends `EventListener`, the
`SettingsManager` pattern: it subscribes to the bus in its constructor and
its `@EventHandler(BotReadyEvent)` iterates every registered metric, runs
`collect()` immediately, and starts a `setInterval` of
`collectIntervalMs` per metric: guilds/ram/cpu/gateway/uptime at 5s, seen
users at 60s, event loop at 1s.

## 7. Env/config

Added to `src/lib/env.ts` (all optional):

| Variable              | Default     | Meaning                                  |
| --------------------- | ----------- | ---------------------------------------- |
| `VM_PUSH_URL`         | unset (off) | VictoriaMetrics `/api/v1/write` endpoint |
| `VM_PUSH_INTERVAL_MS` | `60000`     | Push cadence for the exporter            |

The `job` label comes from the static `Constants.botName` (`"shiroko"`),
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
    instance: os.hostname(),
    intervalMs: Number(env.VM_PUSH_INTERVAL_MS ?? 60_000),
  });
  exporter.start();
}
```

## 9. Serialization example (what VM receives)

```
# TYPE shiroko_guilds gauge
shiroko_guilds{job="shiroko",instance="host01"} 14
# TYPE shiroko_process_ram_used gauge
shiroko_process_ram_used{job="shiroko",instance="host01"} 184.4
# TYPE shiroko_event_loop_ms histogram
shiroko_event_loop_ms_bucket{le="0.05",job="shiroko"} 3
shiroko_event_loop_ms_bucket{le="0.1",job="shiroko"} 4
shiroko_event_loop_ms_bucket{le="+Inf",job="shiroko"} 4
shiroko_event_loop_ms_sum{job="shiroko"} 0.220
shiroko_event_loop_ms_count{job="shiroko"} 4
```

## 10. Testing

No tests ship with the metrics subsystem; it is verified by type-checking
(`bunx tsc --noEmit`) which catches wrong metric classes at the branded-id
call sites. If tests are added later they must run headless (no VM, no
network); the exporter can be exercised with a `fetch` stub.

## 11. Rollout

1. Land `src/metrics/` (registry + types + collectors) with tests.
2. Land the exporter behind `VM_PUSH_URL`; run dev pushes in the terminal
   against a local VM container, verify in VMUI.
3. Add the dashboard queries in Grafana (out of scope for this plan).
