import { afterAll, describe, expect, test } from "bun:test";
import { VictoriaMetricsExporter } from "./exporter";
import type { MetricManager, MetricSnapshot } from "./index";

/** A manager stand-in: the exporter only ever calls `snapshot()`. */
function managerOf(snapshot: MetricSnapshot[]): MetricManager {
  return { snapshot: () => snapshot } as unknown as MetricManager;
}

/** Capture the body the exporter pushes, without a VictoriaMetrics server. */
function capturePush(): { bodies: string[]; restore: () => void } {
  const bodies: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  return { bodies, restore: () => (globalThis.fetch = original) };
}

const captured = capturePush();
afterAll(() => captured.restore());

async function pushOnce(snapshot: MetricSnapshot[]): Promise<string> {
  const exporter = new VictoriaMetricsExporter(managerOf(snapshot), { url: "http://vm.test", job: "arona" });
  exporter.start();
  await Bun.sleep(0);
  return captured.bodies.at(-1) ?? "";
}

describe("VictoriaMetricsExporter", () => {
  test("serializes a gauge with the job label", async () => {
    const body = await pushOnce([{ id: "guilds", kind: "gauge", label: "event", value: 7 }]);
    expect(body).toContain('guilds{job="arona"} 7');
  });

  test("counter_map exports one line per key, under the metric's label", async () => {
    const body = await pushOnce([
      {
        id: "cache_entries",
        kind: "counter_map",
        label: "cache",
        value: { "guild-settings:size": 4, "global-users:hits": 9 },
      },
    ]);
    expect(body).toContain('cache_entries{job="arona",cache="guild-settings:size"} 4');
    expect(body).toContain('cache_entries{job="arona",cache="global-users:hits"} 9');
  });

  test("histogram buckets carry the le label", async () => {
    const body = await pushOnce([
      {
        id: "event_loop_ms",
        kind: "histogram",
        label: "event",
        value: { buckets: [10, 50], counts: [3, 2], sum: 120, count: 5 },
      },
    ]);
    expect(body).toContain('event_loop_ms_bucket{job="arona",le="10"} 3');
    expect(body).toContain('event_loop_ms_bucket{job="arona",le="50"} 5');
    expect(body).toContain('event_loop_ms_bucket{job="arona",le="+Inf"} 5');
    expect(body).toContain('event_loop_ms_sum{job="arona"} 120');
    expect(body).toContain('event_loop_ms_count{job="arona"} 5');
  });
});
