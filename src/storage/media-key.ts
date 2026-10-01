import StorageService, { StorageBucket } from "./storage";

/**
 * The kinds of user asset kept in storage. The value is both the
 * `media.kind` column and the leading key segment, so a kind is added in
 * one place: this enum.
 */
export enum MediaKind {
  Avatar = "avatar",
  Banner = "banner",
}

/**
 * One side of a media change: Discord's asset hash and the live CDN URL the
 * bytes are fetched from. Either is null when the asset is absent.
 */
export interface AssetChange {
  /** Discord's asset hash, including the `a_` prefix when animated. */
  readonly hash: string | null;
  /** Live Discord CDN URL to fetch the bytes from, or null when absent. */
  readonly sourceUrl: string | null;
}

/**
 * The format an asset is stored and served in. Discord prefixes an animated
 * asset hash with `a_`, and only GIF preserves the animation; static assets
 * are stored as WebP.
 *
 * @param hash - Discord's asset hash, including the `a_` prefix when animated.
 * @returns the file extension to store under.
 */
export function assetExtension(hash: string): "webp" | "gif" {
  return hash.startsWith("a_") ? "gif" : "webp";
}

/**
 * The MIME type for a stored extension.
 *
 * @param extension - the stored file's extension.
 * @returns the content type to upload with.
 */
export function assetContentType(extension: "webp" | "gif"): string {
  return extension === "gif" ? "image/gif" : "image/webp";
}

/**
 * The object key an asset is stored under. The hash makes the key
 * content-addressed and stable, so the same asset always maps to the same
 * object.
 *
 * @param kind - the media kind.
 * @param userId - the Discord user id.
 * @param hash - Discord's asset hash.
 * @returns the object key.
 */
export function mediaKey(kind: MediaKind, userId: string, hash: string): string {
  return `${kind}/${userId}/${hash}.${assetExtension(hash)}`;
}

/**
 * The public URL a stored asset is served from.
 *
 * @param kind - the media kind.
 * @param userId - the Discord user id.
 * @param hash - Discord's asset hash.
 * @returns the public URL.
 */
export function mediaUrl(kind: MediaKind, userId: string, hash: string): string {
  return StorageService.getPublicUrl(StorageBucket.Media, mediaKey(kind, userId, hash));
}
