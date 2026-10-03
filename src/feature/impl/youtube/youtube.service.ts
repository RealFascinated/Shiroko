import { db } from "@/db/index";
import { seenYoutubeUploadsSchema } from "@/db/schemas/seen-youtube-uploads";
import { youtubeChannelsSchema } from "@/db/schemas/youtube-channels";
import { youtubeSubscriptionsSchema } from "@/db/schemas/youtube-subscriptions";
import { loadPage, type Page } from "@/lib/pagination";
import { TimeUnit } from "@/lib/time";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { YoutubeChannel } from "./youtube-channel";
import type { FeedVideo } from "./youtube-feed";

/** How many channels one guild may track; keeps a single guild's poll load bounded. */
export const MAX_CHANNELS_PER_GUILD = 25;

/**
 * Channels per `/youtube show` page. Smaller than the leaderboard's default
 * 20 so long YouTube channel names cannot push the embed description past
 * Discord's 4096-character cap.
 */
const CHANNELS_PER_PAGE = 10;

/** How long a seen upload is kept before the sweep prunes it. */
const RETENTION_MS = TimeUnit.toMillis(TimeUnit.Day, 30);

function retentionCutoff(): Date {
  return new Date(Date.now() - RETENTION_MS);
}

/** A destination: the guild and Discord channel an upload is announced in. */
export interface YoutubeDestination {
  guildId: string;
  discordChannelId: string;
}

/** A tracked channel plus every guild destination it feeds. */
export interface YoutubePollTarget extends YoutubeChannel {
  etag: string | null;
  lastModified: string | null;
  /** Newest video id from the previous successful poll; null until the first. */
  lastVideoId: string | null;
  destinations: YoutubeDestination[];
}

/** One tracked channel as shown by `/youtube show`. */
export interface TrackedChannelView extends YoutubeChannel {
  discordChannelId: string;
}

/** An upload that was claimed but whose fan-out did not reach a destination. */
export interface PendingUpload {
  youtubeChannelId: string;
  videoId: string;
  title: string;
}

/** The fetch state persisted after a successful poll. */
export interface FetchState {
  displayName?: string;
  lastVideoId?: string | null;
  etag?: string | null;
  lastModified?: string | null;
}

export class YoutubeService {
  /**
   * Track `youtubeChannelId` in `guildId`, announcing to `discordChannelId`.
   * Re-adding the same channel repoints its destination rather than failing,
   * and an existing global row keeps its fetch state.
   */
  public static async addSubscription(
    guildId: string,
    youtubeChannelId: string,
    displayName: string,
    handle: string | null,
    discordChannelId: string
  ): Promise<void> {
    await db
      .insert(youtubeChannelsSchema)
      .values({ id: youtubeChannelId, displayName, handle })
      .onConflictDoUpdate({
        target: youtubeChannelsSchema.id,
        set: { displayName, handle },
      });

    await db
      .insert(youtubeSubscriptionsSchema)
      .values({ guildId, youtubeChannelId, discordChannelId })
      .onConflictDoUpdate({
        target: [youtubeSubscriptionsSchema.guildId, youtubeSubscriptionsSchema.youtubeChannelId],
        set: { discordChannelId },
      });
  }

  /**
   * Remove the guild's subscription, returning the channel that was removed
   * so the caller can name it, or null when the guild tracked nothing. The
   * shared channel row is deleted only once no guild references it, so the
   * feed keeps its dedupe state while anyone still tracks it.
   */
  public static async removeSubscription(
    guildId: string,
    youtubeChannelId: string
  ): Promise<YoutubeChannel | null> {
    // Read the name first: `deleteIfOrphaned` may remove the channel row.
    const [channel] = await db
      .select({ id: youtubeChannelsSchema.id, displayName: youtubeChannelsSchema.displayName })
      .from(youtubeChannelsSchema)
      .where(eq(youtubeChannelsSchema.id, youtubeChannelId));

    const [removed] = await db
      .delete(youtubeSubscriptionsSchema)
      .where(
        and(
          eq(youtubeSubscriptionsSchema.guildId, guildId),
          eq(youtubeSubscriptionsSchema.youtubeChannelId, youtubeChannelId)
        )
      )
      .returning({ youtubeChannelId: youtubeSubscriptionsSchema.youtubeChannelId });
    if (!removed) {
      return null;
    }
    await YoutubeService.deleteIfOrphaned(youtubeChannelId);
    return channel ?? { id: youtubeChannelId, displayName: youtubeChannelId };
  }

  /**
   * Drop every subscription a departed guild held, then any channel row left
   * with none. Called from `GuildLeftEvent` so a dead guild stops being polled.
   */
  public static async removeGuild(guildId: string): Promise<void> {
    const removed = await db
      .delete(youtubeSubscriptionsSchema)
      .where(eq(youtubeSubscriptionsSchema.guildId, guildId))
      .returning({ youtubeChannelId: youtubeSubscriptionsSchema.youtubeChannelId });
    for (const channelId of new Set(removed.map(row => row.youtubeChannelId))) {
      await YoutubeService.deleteIfOrphaned(channelId);
    }
  }

  private static async deleteIfOrphaned(youtubeChannelId: string): Promise<void> {
    const [remaining] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(youtubeSubscriptionsSchema)
      .where(eq(youtubeSubscriptionsSchema.youtubeChannelId, youtubeChannelId));
    if ((remaining?.count ?? 0) === 0) {
      await db.delete(youtubeChannelsSchema).where(eq(youtubeChannelsSchema.id, youtubeChannelId));
    }
  }

  /**
   * One page of the guild's tracked channels, in add order. `page` is
   * 1-based and clamped into range; the rows come from the database via
   * `LIMIT`/`OFFSET`, never from slicing a full result.
   */
  public static async pageForGuild(guildId: string, page: number): Promise<Page<TrackedChannelView>> {
    return loadPage({
      page,
      pageSize: CHANNELS_PER_PAGE,
      count: () => YoutubeService.countForGuild(guildId),
      rows: (limit, offset) =>
        db
          .select({
            id: youtubeChannelsSchema.id,
            displayName: youtubeChannelsSchema.displayName,
            discordChannelId: youtubeSubscriptionsSchema.discordChannelId,
          })
          .from(youtubeSubscriptionsSchema)
          .innerJoin(
            youtubeChannelsSchema,
            eq(youtubeChannelsSchema.id, youtubeSubscriptionsSchema.youtubeChannelId)
          )
          .where(eq(youtubeSubscriptionsSchema.guildId, guildId))
          .orderBy(youtubeChannelsSchema.addedAt)
          .limit(limit)
          .offset(offset),
    });
  }

  public static async countForGuild(guildId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(youtubeSubscriptionsSchema)
      .where(eq(youtubeSubscriptionsSchema.guildId, guildId));
    return row?.count ?? 0;
  }

  public static async getDestination(guildId: string, youtubeChannelId: string): Promise<string | undefined> {
    const [row] = await db
      .select({ discordChannelId: youtubeSubscriptionsSchema.discordChannelId })
      .from(youtubeSubscriptionsSchema)
      .where(
        and(
          eq(youtubeSubscriptionsSchema.guildId, guildId),
          eq(youtubeSubscriptionsSchema.youtubeChannelId, youtubeChannelId)
        )
      );
    return row?.discordChannelId;
  }

  /**
   * Every tracked channel with its destinations, for one poll cycle. One row
   * per subscription, grouped into a target per channel.
   */
  public static async pollTargets(): Promise<YoutubePollTarget[]> {
    const rows = await db
      .select({
        id: youtubeChannelsSchema.id,
        displayName: youtubeChannelsSchema.displayName,
        etag: youtubeChannelsSchema.etag,
        lastModified: youtubeChannelsSchema.lastModified,
        lastVideoId: youtubeChannelsSchema.lastVideoId,
        guildId: youtubeSubscriptionsSchema.guildId,
        discordChannelId: youtubeSubscriptionsSchema.discordChannelId,
      })
      .from(youtubeChannelsSchema)
      .innerJoin(
        youtubeSubscriptionsSchema,
        eq(youtubeSubscriptionsSchema.youtubeChannelId, youtubeChannelsSchema.id)
      );

    const byChannel = new Map<string, YoutubePollTarget>();
    for (const row of rows) {
      const target = byChannel.get(row.id) ?? {
        id: row.id,
        displayName: row.displayName,
        etag: row.etag,
        lastModified: row.lastModified,
        lastVideoId: row.lastVideoId,
        destinations: [],
      };
      target.destinations.push({ guildId: row.guildId, discordChannelId: row.discordChannelId });
      byChannel.set(row.id, target);
    }
    return [...byChannel.values()];
  }

  /**
   * Claim a video as seen. `true` means the row was inserted (the video is
   * new); `false` means it already existed, so a concurrent or earlier poll
   * owns it. The insert is the source of truth, not a read-then-write.
   */
  public static async claimUpload(youtubeChannelId: string, video: FeedVideo): Promise<boolean> {
    const [row] = await db
      .insert(seenYoutubeUploadsSchema)
      .values({
        youtubeChannelId,
        videoId: video.videoId,
        title: video.title,
        publishedAt: video.publishedAt,
      })
      .onConflictDoNothing({
        target: [seenYoutubeUploadsSchema.youtubeChannelId, seenYoutubeUploadsSchema.videoId],
      })
      .returning({ videoId: seenYoutubeUploadsSchema.videoId });
    return row !== undefined;
  }

  public static async markPosted(youtubeChannelId: string, videoId: string): Promise<void> {
    await db
      .update(seenYoutubeUploadsSchema)
      .set({ posted: true })
      .where(
        and(
          eq(seenYoutubeUploadsSchema.youtubeChannelId, youtubeChannelId),
          eq(seenYoutubeUploadsSchema.videoId, videoId)
        )
      );
  }

  /**
   * Uploads claimed but never successfully announced, within the retention
   * window. Bounded so a permanently dead destination cannot replay forever.
   */
  public static async pendingUploads(): Promise<PendingUpload[]> {
    return db
      .select({
        youtubeChannelId: seenYoutubeUploadsSchema.youtubeChannelId,
        videoId: seenYoutubeUploadsSchema.videoId,
        title: seenYoutubeUploadsSchema.title,
      })
      .from(seenYoutubeUploadsSchema)
      .where(
        and(
          eq(seenYoutubeUploadsSchema.posted, false),
          sql`${seenYoutubeUploadsSchema.seenAt} >= ${retentionCutoff()}`
        )
      );
  }

  public static async markChecked(youtubeChannelId: string): Promise<void> {
    await db
      .update(youtubeChannelsSchema)
      .set({ lastCheckedAt: new Date() })
      .where(eq(youtubeChannelsSchema.id, youtubeChannelId));
  }

  /**
   * Seed the newest video id on a channel that has never been polled, so a
   * freshly tracked channel does not announce its back catalogue. Guarded on
   * `lastVideoId IS NULL`: a channel another guild already polls keeps its
   * pointer, so this can never move it backwards and re-announce.
   */
  public static async seedLastVideoIfUnset(
    youtubeChannelId: string,
    videoId: string | null,
    validators: { etag?: string | null; lastModified?: string | null } = {}
  ): Promise<void> {
    await db
      .update(youtubeChannelsSchema)
      .set({
        lastVideoId: videoId,
        etag: validators.etag,
        lastModified: validators.lastModified,
        lastCheckedAt: new Date(),
      })
      .where(and(eq(youtubeChannelsSchema.id, youtubeChannelId), isNull(youtubeChannelsSchema.lastVideoId)));
  }

  /**
   * Persist the fetch result: the display name, the newest video id that
   * bounds the next poll, and the conditional-request validators.
   */
  public static async saveFetchState(youtubeChannelId: string, state: FetchState): Promise<void> {
    const set: Partial<typeof youtubeChannelsSchema.$inferInsert> = { lastCheckedAt: new Date() };
    if (state.displayName !== undefined) {
      set.displayName = state.displayName;
    }
    if (state.lastVideoId !== undefined) {
      set.lastVideoId = state.lastVideoId;
    }
    if (state.etag !== undefined) {
      set.etag = state.etag;
    }
    if (state.lastModified !== undefined) {
      set.lastModified = state.lastModified;
    }
    await db.update(youtubeChannelsSchema).set(set).where(eq(youtubeChannelsSchema.id, youtubeChannelId));
  }

  /**
   * Drop seen uploads past the retention window, keeping the dedupe table
   * bounded. Called by the nightly sweep.
   */
  public static async pruneSeenUploads(): Promise<number> {
    const rows = await db
      .delete(seenYoutubeUploadsSchema)
      .where(lt(seenYoutubeUploadsSchema.seenAt, retentionCutoff()))
      .returning({ videoId: seenYoutubeUploadsSchema.videoId });
    return rows.length;
  }
}
