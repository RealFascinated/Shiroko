import type { PartialUser, User } from "discord.js";
import { type AssetChange, MediaKind } from "./media-key";

/** Extract one asset from a user, resolved by kind. */
const ASSET: Record<MediaKind, (user: User | PartialUser) => AssetChange> = {
  [MediaKind.Avatar]: user => ({ hash: user.avatar ?? null, sourceUrl: user.avatarURL({ size: 4096 }) }),
  [MediaKind.Banner]: user => ({
    hash: user.banner ?? null,
    sourceUrl: user.bannerURL({ size: 4096 }) ?? null,
  }),
};

/**
 * The hash and live CDN URL of one of a user's assets, resolved by kind.
 * The caller that owns a change event uses this to describe both sides to
 * `MediaService.capture`, so the event carries resolved URLs rather than
 * making each listener reach into storage.
 *
 * @param kind - the media kind.
 * @param user - the user whose asset is read.
 * @returns the asset's hash and source URL.
 */
export function assetChange(kind: MediaKind, user: User | PartialUser): AssetChange {
  return ASSET[kind](user);
}
