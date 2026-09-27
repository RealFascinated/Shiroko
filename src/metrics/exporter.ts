import type { MetricManager } from "./index";
import { encodePushPayload } from "./remote-write";

export interface ExporterOptions {
  /** Full VictoriaMetrics `/api/v1/write` URL. */
  readonly url: string;
  /** `job` label attached to every series. */
  readonly job: string;
  /** `instance` label attached to every series. */
  readonly instance: string;
  /** Milliseconds between pushes. Default 60_000. */
  readonly intervalMs?: number;
  /** Max bytes per HTTP request; larger payloads are chunked. Default 1 MB. */
  readonly maxBatchBytes?: number;
}

/**
 * Pushes the manager's metric snapshots to VictoriaMetrics over the
 * Prometheus remote-write protocol (`PUT /api/v1/write`, snappy).
 *
 * Failure handling is deliberately simple: one attempt per interval, an
 * error is logged and the next interval retries with fresh values. Metrics
 * are read-only during serialization, so a failed push never corrupts the
 * registry.
 */
export class VictoriaMetricsExporter {
  private readonly url: string;
  private readonly job: string;
  private readonly instance: string;
  private readonly intervalMs: number;
  private readonly maxBatchBytes: number;
  private timer: Timer | undefined;

  public constructor(
    private readonly manager: MetricManager,
    options: ExporterOptions
  ) {
    this.url = options.url;
    this.job = options.job;
    this.instance = options.instance;
    this.intervalMs = options.intervalMs ?? 60_000;
    this.maxBatchBytes = options.maxBatchBytes ?? 1024 * 1024;
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
    const snapshot = this.manager.snapshot();
    const payload = encodePushPayload(snapshot, { job: this.job, instance: this.instance });
    const chunks = this.chunk(payload);
    for (const chunk of chunks) {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-protobuf",
          "Content-Encoding": "snappy",
          "X-Prometheus-Remote-Write-Version": "0.1.0",
        },
        body: chunk,
      });
      if (!res.ok) {
        throw new Error(`VictoriaMetrics push failed: ${res.status} ${res.statusText}`);
      }
    }
  }

  /** Split an oversized payload into per-request chunks. */
  private chunk(payload: Uint8Array): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < payload.length; offset += this.maxBatchBytes) {
      chunks.push(payload.subarray(offset, offset + this.maxBatchBytes));
    }
    return chunks;
  }
}
