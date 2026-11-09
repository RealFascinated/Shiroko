import type { Pool } from "pg";
import { DbPoolMetric, DbQueryDurationMetric, DbQueryErrorsMetric } from "./impl/database";
import type { Metric } from "./metric";

/**
 * Instruments the Postgres pool behind drizzle. Queries are timed by
 * wrapping `pool.query`, which is what drizzle calls for every statement
 * outside a transaction; statements inside `db.transaction` run on a
 * checked-out client and are not timed.
 */
export class DbListeners {
  public readonly pool: DbPoolMetric;
  public readonly duration: DbQueryDurationMetric = new DbQueryDurationMetric();
  public readonly errors: DbQueryErrorsMetric = new DbQueryErrorsMetric();

  public constructor(pool: Pool) {
    this.pool = new DbPoolMetric(pool);
    this.instrumentQuery(pool);
  }

  public get metrics(): Metric<any>[] {
    return [this.pool, this.duration, this.errors];
  }

  private instrumentQuery(pool: Pool): void {
    const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
    pool.query = (async (...args: unknown[]) => {
      const start = performance.now();
      try {
        return await query(...args);
      } catch (error) {
        this.errors.increment();
        throw error;
      } finally {
        this.duration.observe(performance.now() - start);
      }
    }) as Pool["query"];
  }
}
