import type { Pool } from "pg";
import { CounterMetric } from "../counter";
import { HistogramMetric } from "../histogram";
import { Metric } from "../metric";

/**
 * Postgres pool occupancy by `state`: `total` open connections, `idle`
 * ones, and `waiting` queries queued for a connection. Any sustained
 * `waiting` means the pool is the bottleneck, not Postgres.
 */
export class DbPoolMetric extends Metric<Record<string, number>> {
  public override readonly collectIntervalMs: number = 5_000;
  private current: Record<string, number> = {};

  public constructor(private readonly pool: Pool) {
    super({
      id: "db_pool_connections",
      kind: "counter_map",
      label: "state",
      help: "Postgres pool connections by state",
    });
  }

  public override collect(): void {
    this.current = {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  public value(): Record<string, number> {
    return this.current;
  }
}

export class DbQueryDurationMetric extends HistogramMetric {
  public constructor() {
    super(
      {
        id: "db_query_duration_ms",
        kind: "histogram",
        unit: "ms",
        help: "Postgres query duration in milliseconds",
      },
      [1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 5000]
    );
  }
}

export class DbQueryErrorsMetric extends CounterMetric {
  public constructor() {
    super({ id: "db_query_errors_total", kind: "counter", help: "Postgres queries that failed" });
  }
}
