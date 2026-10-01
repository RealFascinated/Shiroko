import { EventBus } from "@/event/event-bus";
import { EventHandler } from "@/event/event-handler";
import { EventListener } from "@/event/event-listener";
import BotReadyEvent from "@/event/events/bot-ready.event";
import UserAvatarUpdatedEvent from "@/event/events/user-avatar-updated.event";
import UserBannerUpdatedEvent from "@/event/events/user-banner-updated.event";
import type { PartialUser, User } from "discord.js";
import { MediaKind } from "./media-key";
import MediaService, { runMediaSweep } from "./media.service";

const SWEEP_CRON = "0 3 * * *"; // 03:00 daily

/** The hash and live CDN URL of one of a user's assets, by kind. */
const LIVE_ASSET: Record<
  MediaKind,
  (user: User | PartialUser) => { hash: string | null; url: string | null }
> = {
  [MediaKind.Avatar]: user => ({ hash: user.avatar ?? null, url: user.avatarURL({ size: 4096 }) }),
  [MediaKind.Banner]: user => ({ hash: user.banner ?? null, url: user.bannerURL({ size: 4096 }) ?? null }),
};

/**
 * Captures a user's previous avatar and banner before Discord drops them,
 * and arms the nightly expiry sweep.
 *
 * Storage is global, not per guild: the change events fan out per mutual
 * guild, so the same change lands here several times. `MediaService`
 * deduplicates, which keeps the repeat calls from re-fetching; the first
 * one does the work and the rest are no-ops.
 */
export class MediaListeners extends EventListener {
  private job: Bun.CronJob | undefined;

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(): Promise<void> {
    this.job?.stop();
    this.job = Bun.cron(SWEEP_CRON, () => runMediaSweep(), { tz: "UTC" });
  }

  @EventHandler(UserAvatarUpdatedEvent)
  public async onAvatarUpdated(event: UserAvatarUpdatedEvent): Promise<void> {
    await this.capture(MediaKind.Avatar, event.newUser, event.oldUser);
  }

  @EventHandler(UserBannerUpdatedEvent)
  public async onBannerUpdated(event: UserBannerUpdatedEvent): Promise<void> {
    await this.capture(MediaKind.Banner, event.newUser, event.oldUser);
  }

  /**
   * Record both sides of a change. The previous asset is backfilled as
   * historical (it was never seen as "new") so it starts its TTL, and the
   * new asset becomes current. A removed asset has no live URL, so the last
   * current one is superseded instead, which starts its TTL.
   */
  private async capture(
    kind: MediaKind,
    newUser: User | PartialUser,
    oldUser: User | PartialUser
  ): Promise<void> {
    const previous = LIVE_ASSET[kind](oldUser);
    const current = LIVE_ASSET[kind](newUser);
    if (previous.hash === current.hash) {
      return;
    }
    if (previous.hash && previous.url) {
      await MediaService.backfill({
        userId: newUser.id,
        kind,
        hash: previous.hash,
        sourceUrl: previous.url,
      });
    }
    if (current.hash && current.url) {
      await MediaService.store({ userId: newUser.id, kind, hash: current.hash, sourceUrl: current.url });
    } else {
      await MediaService.supersede(newUser.id, kind);
    }
  }
}
