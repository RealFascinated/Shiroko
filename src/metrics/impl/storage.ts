import { CounterMapMetric } from "../counter-map";
import { HistogramMapMetric } from "../histogram-map";

/**
 * S3 call duration in milliseconds by `op` (`write`, `delete`). Writes sit
 * on the avatar/banner capture path, which the bridge awaits before
 * posting the log event, so slow writes delay those logs.
 */
export class StorageDurationMetric extends HistogramMapMetric {
  public constructor() {
    super(
      {
        id: "storage_operation_duration_ms",
        label: "op",
        unit: "ms",
        help: "S3 operation duration in milliseconds, by operation",
      },
      [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    );
  }
}

export class StorageErrorsMetric extends CounterMapMetric {
  public constructor() {
    super({
      id: "storage_operation_errors_total",
      label: "op",
      help: "S3 operations that failed, by operation",
    });
  }
}
