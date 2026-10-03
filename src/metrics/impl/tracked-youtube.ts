import { db } from "@/db/index";
import { youtubeChannelsSchema } from "@/db/schemas/youtube-channels";
import { count } from "drizzle-orm";
import { GaugeMetric } from "../gauge";

/**
 * YouTube channels the bot is polling for new uploads, across every guild.
 *
 * The tracked-channel table is global, so a channel two guilds both track is
 * one row: this is distinct channels, not the number of subscriptions.
 * Falling to zero means the poller has nothing to fetch.
 */
export class TrackedYoutubeChannelsMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 30_000;

  public constructor() {
    super({
      id: "tracked_youtube_channels",
      kind: "gauge",
      help: "YouTube channels tracked for new uploads",
    });
  }

  public override async collect(): Promise<void> {
    const [row] = await db.select({ count: count() }).from(youtubeChannelsSchema);
    this.set(row?.count ?? 0);
  }
}
