import MediaService, { MEDIA_TTL_MS } from "@/storage/media.service";
import Job from "../job";
import { CronSchedule } from "../schedule";

/**
 * Delete the stored file of every superseded avatar and banner whose TTL
 * has passed. The rows stay.
 */
export default class MediaSweepJob extends Job {
  public constructor() {
    super({ id: "media_sweep", schedule: new CronSchedule("0 3 * * *") });
  }

  public override async run(): Promise<void> {
    const removed = await MediaService.deleteExpiredFiles();
    if (removed > 0) {
      console.log(`Deleted ${removed} expired media file(s) past the ${MEDIA_TTL_MS / 86_400_000}-day TTL`);
    }
  }
}
