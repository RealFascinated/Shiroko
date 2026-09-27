import type { HistogramValue } from "./histogram";
import type { MetricManager, MetricSnapshot } from "./index";

export interface ExporterOptions {
  /** VictoriaMetrics base URL, e.g. `http://localhost:8428`. */
  readonly url: string;
  /** `job` label attached to every series. */
  readonly job: string;
  /** Milliseconds between pushes. Default 60_000. */
  readonly intervalMs?: number;
}

/**
 * Serialize a manager snapshot as the Prometheus text exposition format,
 * which VictoriaMetrics accepts on `POST /api/v1/import/prometheus`.
 *
 * Each metric becomes one line; values are explicit per-series labels and
 * the scrape timestamp is omitted (VM stamps ingestion time).
 */
function encodePushPayload(snapshot: MetricSnapshot[], labels: Record<string, string>): string {
  const lines: string[] = [];
  for (const entry of snapshot) {
    const base = formatLabels(labels);
    switch (entry.kind) {
      case "gauge": {
        lines.push(`${entry.id}${base} ${formatValue(entry.value as number)}`);
        break;
      }
      case "histogram": {
        const h = entry.value as HistogramValue;
        let cumulative = 0;
        for (let i = 0; i < h.buckets.length; i++) {
          cumulative += h.counts[i]!;
          lines.push(`${entry.id}_bucket${leLabel(h.buckets[i]!, base)} ${formatValue(cumulative)}`);
        }
        lines.push(`${entry.id}_bucket${leLabel(Infinity, base)} ${formatValue(h.count)}`);
        lines.push(`${entry.id}_sum${base} ${formatValue(h.sum)}`);
        lines.push(`${entry.id}_count${base} ${formatValue(h.count)}`);
        break;
      }
    }
  }
  return lines.join("\n") + "\n";
}

/** `le` is the only per-series label a histogram adds; others inherit `base`. */
function leLabel(bound: number, base: string): string {
  const le = Number.isFinite(bound) ? String(bound) : "+Inf";
  return base === "" ? `{le="${le}"}` : base.slice(0, -1) + `,le="${le}"}`;
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return "";
  }
  return `{${entries.map(([k, v]) => `${k}="${v}"`).join(",")}}`;
}

function formatValue(value: number): string {
  return Object.is(value, -0) ? "0" : String(value);
}

/**
 * Pushes the manager's metric snapshots to VictoriaMetrics via
 * `POST /api/v1/import/prometheus` in the Prometheus text exposition
 * format (no snappy, no protobuf; the body is plain text).
 *
 * Failure handling is deliberately simple: one attempt per interval, an
 * error is logged and the next interval retries with fresh values. Metrics
 * are read-only during serialization, so a failed push never corrupts the
 * registry.
 */
export class VictoriaMetricsExporter {
  private readonly url: string;
  private readonly job: string;
  private readonly intervalMs: number;
  private timer: Timer | undefined;

  public constructor(
    private readonly manager: MetricManager,
    options: ExporterOptions
  ) {
    // Base URL only; the import path is fixed by the protocol.
    this.url = options.url.replace(/\/+$/, "") + "/api/v1/import/prometheus";
    this.job = options.job;
    this.intervalMs = options.intervalMs ?? 60_000;
  }

  /** Begin pushing on an interval. Safe to call once. */
  public start(): void {
    if (this.timer) {
      return;
    }
    void this.push();
    this.timer = setInterval(() => void this.push(), this.intervalMs);
  }

  private async push(): Promise<void> {
    const payload = encodePushPayload(this.manager.snapshot(), { job: this.job });
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: payload,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `VictoriaMetrics push failed: ${res.status} ${res.statusText}\n${detail}\nBody sent:\n${payload}`
      );
    }
  }
}
