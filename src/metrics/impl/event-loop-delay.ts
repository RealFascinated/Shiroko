import { HistogramMetric } from "../histogram";

/**
 * Event loop delay in milliseconds: a timer on the main loop fires only
 * after the loop has been free to run, so each tick observes how much the
 * loop slipped past its nominal interval, i.e. how long it was blocked.
 */
export class EventLoopMetric extends HistogramMetric {
  public override readonly collectIntervalMs: number = 1_000;
  private lastTick: number = performance.now();

  public constructor() {
    super({
      id: "event_loop_ms",
      kind: "histogram",
      help: "Event loop delay in milliseconds",
      unit: "ms",
    });
  }

  public override collect(): void {
    const now = performance.now();
    this.observe(Math.max(0, now - this.lastTick - this.collectIntervalMs));
    this.lastTick = now;
  }
}
