import { forEachLimited } from "@/lib/concurrency";
import { TimeUnit } from "@/lib/time";
import type { Client } from "discord.js";
import { announceUpload, type UploadAnnouncement } from "./youtube-announce";
import { fetchYoutubeFeed, type FeedVideo } from "./youtube-feed";
import { YoutubeService, type YoutubePollTarget } from "./youtube.service";

/** Channels fetched per cycle; bounded so a poll cannot open hundreds of sockets at once. */
const FETCH_CONCURRENCY = 8;

/** Random delay per channel so the cycle does not fire every request at once. */
const MAX_JITTER_MS = TimeUnit.toMillis(TimeUnit.Second, 2);

/**
 * One poll cycle is never allowed to overlap itself: a slow cycle (or a
 * burst of uploads) would otherwise double-post. The flag is module-scoped
 * because only one bot process runs the job.
 */
let running = false;

/**
 * Poll every tracked channel once and announce anything new.
 *
 * Never rejects: `Bun.cron` turns a rejected promise into an
 * `unhandledRejection`, which exits the process without a handler, so each
 * channel is isolated inside {@link pollChannel} and the whole body is
 * guarded, mirroring `runBirthdaySweep`.
 */
export async function runYoutubePoll(client: Client): Promise<void> {
  if (running) {
    console.log("YouTube poll skipped: previous cycle still running");
    return;
  }
  running = true;
  try {
    const targets = await YoutubeService.pollTargets();
    await forEachLimited(targets, FETCH_CONCURRENCY, target => pollChannel(client, target));
    await retryPending(client, targets);
  } catch (error) {
    console.error("YouTube poll failed:", error);
  } finally {
    running = false;
  }
}

/**
 * Fetch one channel and announce its new uploads. A first-ever fetch seeds
 * `lastVideoId` instead of announcing, so adding a channel never dumps its
 * back catalogue.
 */
async function pollChannel(client: Client, target: YoutubePollTarget): Promise<void> {
  try {
    await Bun.sleep(Math.random() * MAX_JITTER_MS);
    const result = await fetchYoutubeFeed(target.id, {
      etag: target.etag,
      lastModified: target.lastModified,
    });
    if (result.notModified) {
      await YoutubeService.markChecked(target.id);
      return;
    }
    const parsed = result.parsed;
    if (!parsed || parsed.videos.length === 0) {
      await YoutubeService.saveFetchState(target.id, {
        displayName: parsed?.channelName || target.displayName,
        etag: result.etag ?? target.etag,
        lastModified: result.lastModified ?? target.lastModified,
      });
      return;
    }

    const channelName = parsed.channelName || target.displayName;
    const newest = parsed.videos[0]!;
    const fresh = newUploads(parsed.videos, target.lastVideoId);
    // Oldest first, so a burst announces in publication order.
    for (const video of fresh.reverse()) {
      await announceOne(client, target, channelName, video);
    }
    await YoutubeService.saveFetchState(target.id, {
      displayName: channelName,
      lastVideoId: newest.videoId,
      etag: result.etag ?? target.etag,
      lastModified: result.lastModified ?? target.lastModified,
    });
  } catch (error) {
    console.error(`YouTube poll failed for channel ${target.id}:`, error);
  }
}

/**
 * Retry uploads the previous cycle claimed but could not deliver, so a
 * destination that was temporarily unsendable still gets the video. Uses
 * this cycle's destinations, which is fine: a channel is only retried while
 * it still has subscriptions.
 */
async function retryPending(client: Client, targets: readonly YoutubePollTarget[]): Promise<void> {
  const byChannel = new Map(targets.map(target => [target.id, target]));
  for (const pending of await YoutubeService.pendingUploads()) {
    const target = byChannel.get(pending.youtubeChannelId);
    if (!target) {
      continue;
    }
    try {
      const delivered = await announceUpload(client, target.destinations, {
        channelName: target.displayName,
        videoId: pending.videoId,
        videoTitle: pending.title,
      });
      if (delivered > 0) {
        await YoutubeService.markPosted(pending.youtubeChannelId, pending.videoId);
      }
    } catch (error) {
      console.error(`YouTube retry failed for ${pending.videoId}:`, error);
    }
  }
}

async function announceOne(
  client: Client,
  target: YoutubePollTarget,
  channelName: string,
  video: FeedVideo
): Promise<void> {
  if (!(await YoutubeService.claimUpload(target.id, video))) {
    return;
  }
  const announcement: UploadAnnouncement = {
    channelName,
    videoId: video.videoId,
    videoTitle: video.title,
  };
  if ((await announceUpload(client, target.destinations, announcement)) > 0) {
    await YoutubeService.markPosted(target.id, video.videoId);
  }
}

/**
 * The entries newer than `lastVideoId`, walking the feed newest-first. The
 * feed window is finite, so a channel that fell off the end announces its
 * whole visible list rather than silently missing uploads. A null
 * `lastVideoId` is a channel's first poll, which seeds instead of announcing.
 */
export function newUploads(videos: readonly FeedVideo[], lastVideoId: string | null): FeedVideo[] {
  if (!lastVideoId) {
    return [];
  }
  const fresh: FeedVideo[] = [];
  for (const video of videos) {
    if (video.videoId === lastVideoId) {
      break;
    }
    fresh.push(video);
  }
  return fresh;
}
