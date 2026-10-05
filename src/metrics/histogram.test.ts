import { describe, expect, test } from "bun:test";
import { HistogramMetric } from "./histogram";

function histogram(): HistogramMetric {
  return new HistogramMetric({ id: "test_ms", kind: "histogram", help: "test" }, [10, 25, 50]);
}

describe("HistogramMetric", () => {
  test("counts each observation into the first bucket it fits", () => {
    const metric = histogram();
    metric.observe(5);
    metric.observe(20);
    metric.observe(20);
    metric.observe(1000);

    expect(metric.value().counts).toEqual([1, 2, 0]);
    expect(metric.value().count).toBe(4);
    expect(metric.value().sum).toBe(1045);
  });

  test("an observation past the last bound lands in no bucket but still counts", () => {
    const metric = histogram();
    metric.observe(1000);

    expect(metric.value().counts).toEqual([0, 0, 0]);
    expect(metric.value().count).toBe(1);
  });

  test("a value exactly on a bound belongs to that bucket", () => {
    const metric = histogram();
    metric.observe(25);

    expect(metric.value().counts).toEqual([0, 1, 0]);
  });
});
