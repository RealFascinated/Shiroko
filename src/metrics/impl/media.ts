import { db } from "@/db/index";
import { mediaSchema } from "@/db/schemas/media";
import { count, isNotNull, isNull, sum } from "drizzle-orm";
import { Metric, type MetricRegistration } from "../metric";

/** Media totals split by whether the object is current or awaiting its TTL. */
interface MediaStateTotals {
  readonly files: Record<string, number>;
  readonly bytes: Record<string, number>;
}

/**
 * Count and byte size of every object in the media bucket, grouped into
 * `live` (the current avatar/banner) and `superseded` (kept until the TTL
 * sweep deletes them). Both states occupy S3, so the bucket's real
 * footprint is their sum; the split shows whether the nightly sweep is
 * keeping up with upload churn.
 */
async function mediaStateTotals(): Promise<MediaStateTotals> {
  const [live] = await db
    .select({ files: count(), bytes: sum(mediaSchema.size) })
    .from(mediaSchema)
    .where(isNull(mediaSchema.supersededAt));
  const [superseded] = await db
    .select({ files: count(), bytes: sum(mediaSchema.size) })
    .from(mediaSchema)
    .where(isNotNull(mediaSchema.supersededAt));
  return {
    files: { live: live?.files ?? 0, superseded: superseded?.files ?? 0 },
    bytes: { live: Number(live?.bytes ?? 0), superseded: Number(superseded?.bytes ?? 0) },
  };
}

/**
 * Shared collection for the media gauges: {@link mediaStateTotals} reads
 * both the counts and the byte sizes in one pass, and a subclass picks the
 * slice it exports.
 */
abstract class MediaStateMetric extends Metric<Record<string, number>> {
  public override readonly collectIntervalMs: number = 30_000;
  private current: Record<string, number> = {};

  protected constructor(registration: MetricRegistration) {
    super(registration);
  }

  /**
   * The slice of {@link mediaStateTotals} this metric reports.
   */
  protected abstract extract(totals: MediaStateTotals): Record<string, number>;

  public override async collect(): Promise<void> {
    this.current = this.extract(await mediaStateTotals());
  }

  public value(): Record<string, number> {
    return this.current;
  }
}

/**
 * Stored media objects, one series per state. `media_files{state="live"}`
 * is what users see now; `superseded` is the backlog the sweep deletes
 * after the TTL. A `superseded` count that climbs without bound means
 * uploads are outpacing the sweep.
 */
export class MediaFilesMetric extends MediaStateMetric {
  public constructor() {
    super({
      id: "media_files",
      kind: "counter_map",
      label: "state",
      help: "Stored media objects in the bucket, by state",
    });
  }

  protected override extract(totals: MediaStateTotals): Record<string, number> {
    return totals.files;
  }
}

/**
 * Byte size of the stored media objects, one series per state. Summed,
 * this is the bucket's real occupancy, the figure the S3 bill is based on.
 */
export class MediaBytesMetric extends MediaStateMetric {
  public constructor() {
    super({
      id: "media_bytes",
      kind: "counter_map",
      label: "state",
      unit: "bytes",
      help: "Bytes of stored media objects in the bucket, by state",
    });
  }

  protected override extract(totals: MediaStateTotals): Record<string, number> {
    return totals.bytes;
  }
}
