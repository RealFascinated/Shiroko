import { CounterMapMetric } from "../counter-map";
import { HistogramMapMetric } from "../histogram-map";

/**
 * Time each bus handler took in milliseconds, keyed `Listener.method`.
 * Handlers run one after another, so a slow one delays every handler
 * behind it for the same event.
 */
export class EventHandlerDurationMetric extends HistogramMapMetric {
  public constructor() {
    super(
      {
        id: "event_handler_duration_ms",
        label: "handler",
        unit: "ms",
        help: "Event bus handler duration in milliseconds",
      },
      [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000]
    );
  }
}

/**
 * Handlers that threw. The bus logs and swallows these, so this series is
 * the only place they surface besides the console.
 */
export class EventHandlerErrorsMetric extends CounterMapMetric {
  public constructor() {
    super({
      id: "event_handler_errors_total",
      label: "handler",
      help: "Event bus handlers that threw, by handler",
    });
  }
}
