import type { Client } from "discord.js";
import { assetChange } from "@/storage/media-asset";
import { MediaKind } from "@/storage/media-key";
import MediaService from "@/storage/media.service";
import Job from "../job";
import { CronSchedule } from "../schedule";

/**
 * Bring stored media in line with what the gateway knows: store any cached
 * user's current asset that is missing (joined before capture existed, or
 * changed while the bot was offline) and supersede a stored one the user
 * has since removed.
 *
 * Only users the client has cached are checked, and a banner only when it
 * is known: gateway member payloads carry no banner, so discord.js leaves
 * `user.banner` undefined until the user is fetched, and treating that as
 * "no banner" would supersede a live one. Bots are skipped, as in
 * `EventBridge`.
 */
export default class MediaSyncJob extends Job {
  public constructor() {
    super({ id: "media_sync", schedule: new CronSchedule("30 3 * * *"), runOnReady: true });
  }

  public override async run(client: Client): Promise<void> {
    const users = [...client.users.cache.values()].filter(user => !user.bot);
    let stored = 0;
    for (const kind of Object.values(MediaKind)) {
      const live = await MediaService.liveHashes(kind);
      for (const user of users) {
        if (kind === MediaKind.Banner && user.banner === undefined) {
          continue;
        }
        const { hash, sourceUrl } = assetChange(kind, user);
        if (hash === (live.get(user.id) ?? null)) {
          continue;
        }
        if (hash && sourceUrl) {
          if (await MediaService.store({ userId: user.id, kind, hash, sourceUrl })) {
            stored++;
          }
        } else {
          await MediaService.supersede(user.id, kind);
        }
      }
    }
    if (stored > 0) {
      console.log(`Media sync stored ${stored} missing asset(s)`);
    }
  }
}
