import { db } from "@/db/index";
import { globalUsersSchema } from "@/db/schemas/global-users";
import { count } from "drizzle-orm";
import { GaugeMetric } from "../gauge";

/**
 * Number of distinct users ever seen, from `global_users`. Expensive (a
 * COUNT over the whole table), so it collects on a slower interval.
 */
export class SeenUsersMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 60_000;

  public constructor() {
    super({ id: "seen_users", kind: "gauge", help: "Number of distinct users ever seen" });
  }

  public override async collect(): Promise<void> {
    const [row] = await db.select({ count: count() }).from(globalUsersSchema);
    this.set(row?.count ?? 0);
  }
}
