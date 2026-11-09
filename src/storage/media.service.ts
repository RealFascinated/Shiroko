import { and, eq, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { db } from "../db/index";
import { mediaSchema } from "../db/schemas/media";
import { FETCH_TIMEOUT_MS } from "../lib/fetch";
import {
  assetContentType,
  assetExtension,
  mediaKey,
  MediaKind,
  mediaUrl,
  type AssetChange,
} from "./media-key";
import StorageService, { StorageBucket } from "./storage";

export interface StoreMediaOptions {
  readonly userId: string;
  readonly kind: MediaKind;
  readonly hash: string;
  readonly sourceUrl: string;
}

/** How long a superseded asset's file is kept before the sweep deletes it from storage. */
export const MEDIA_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generic storage for user media (avatars, banners, and anything added to
 * {@link MediaKind}).
 *
 * The asset Discord hands us is public and content-addressed by its hash,
 * so a row's identity is `(userId, kind, hash)`. "Current" is a property of
 * the row, not the user: at most one row per `(userId, kind)` has a null
 * `supersededAt`, and every earlier version keeps that timestamp until the
 * TTL passes. This is what makes the current asset durable and the previous
 * ones expirable without a second table or a status column.
 *
 * Storing is idempotent: a hash is uploaded and inserted once, and a repeat
 * (a user who changes back, or a retried upload) refreshes the existing row
 * instead of duplicating it.
 */
export default class MediaService {
  /**
   * Store the asset at `sourceUrl` as the user's current asset of its kind,
   * superseding whatever was current before.
   */
  public static async store(options: StoreMediaOptions): Promise<boolean> {
    const { userId, kind, hash } = options;

    // A change fans out per mutual guild, so the same hash arrives several
    // times. Once it is current there is nothing left to do; short-circuit
    // before fetching the bytes again.
    const live = await MediaService.liveHash(userId, kind);
    if (live === hash) {
      return true;
    }

    const size = await MediaService.upload(options);
    if (size === null) {
      return false;
    }

    // Supersede the live asset only when it is a different hash, so
    // re-storing the current one does not expire it.
    await db
      .update(mediaSchema)
      .set(MediaService.superseded(new Date()))
      .where(
        and(
          eq(mediaSchema.userId, userId),
          eq(mediaSchema.kind, kind),
          isNull(mediaSchema.supersededAt),
          ne(mediaSchema.hash, hash)
        )
      );

    await db
      .insert(mediaSchema)
      .values(MediaService.row(options, size, null))
      .onConflictDoUpdate({
        target: [mediaSchema.userId, mediaSchema.kind, mediaSchema.hash],
        set: { size, supersededAt: null, expiresAt: null, deletedAt: null },
      });
    return true;
  }

  /**
   * Store an asset that is already historical: the user's previous avatar
   * or banner, captured because it was never seen as "new". It is marked
   * superseded immediately, so it starts its TTL now rather than lingering
   * as a second current asset.
   *
   * A hash already in storage is left alone, which keeps a duplicate event
   * (two guilds fanning out the same change, or a retry) from re-fetching.
   */
  public static async backfill(options: StoreMediaOptions): Promise<boolean> {
    const [existing] = await db
      .select({ hash: mediaSchema.hash })
      .from(mediaSchema)
      .where(
        and(
          eq(mediaSchema.userId, options.userId),
          eq(mediaSchema.kind, options.kind),
          eq(mediaSchema.hash, options.hash)
        )
      );
    if (existing) {
      return true;
    }
    const size = await MediaService.upload(options);
    if (size === null) {
      return false;
    }
    await db
      .insert(mediaSchema)
      .values(MediaService.row(options, size, new Date()))
      .onConflictDoNothing({ target: [mediaSchema.userId, mediaSchema.kind, mediaSchema.hash] });
    return true;
  }

  /**
   * Mark the user's live asset of a kind as superseded. Used when an asset
   * is removed: there is nothing new to store, but the previous one should
   * start its TTL.
   */
  public static async supersede(userId: string, kind: MediaKind): Promise<void> {
    await db
      .update(mediaSchema)
      .set(MediaService.superseded(new Date()))
      .where(
        and(eq(mediaSchema.userId, userId), eq(mediaSchema.kind, kind), isNull(mediaSchema.supersededAt))
      );
  }

  /**
   * Record a change to a user's asset and return the stored URLs on both
   * sides. The previous asset is backfilled as historical (it was never
   * seen as "new") so it starts its TTL, and the new asset becomes current;
   * a removed asset has no live URL, so the last current one is superseded
   * instead.
   *
   * Resolving the URLs here, before the change event is posted, is what
   * lets every listener render a link that is known to exist: an upload can
   * legitimately fail (Discord has usually invalidated the old hash by the
   * time the change is observed), so the URL is only valid once the bytes
   * were written.
   */
  public static async capture(
    userId: string,
    kind: MediaKind,
    previous: AssetChange,
    current: AssetChange
  ): Promise<{ beforeUrl: string | null; afterUrl: string | null }> {
    try {
      if (previous.hash !== current.hash) {
        if (previous.hash && previous.sourceUrl) {
          await MediaService.backfill({ userId, kind, hash: previous.hash, sourceUrl: previous.sourceUrl });
        }
        if (current.hash && current.sourceUrl) {
          await MediaService.store({ userId, kind, hash: current.hash, sourceUrl: current.sourceUrl });
        } else {
          await MediaService.supersede(userId, kind);
        }
      }
      const [beforeUrl, afterUrl] = await Promise.all([
        previous.hash ? MediaService.storedUrl(kind, userId, previous.hash) : null,
        current.hash ? MediaService.storedUrl(kind, userId, current.hash) : null,
      ]);
      return { beforeUrl, afterUrl };
    } catch (error) {
      // Called from gateway handlers, where a rejection would be unhandled.
      console.error(`Failed to capture ${kind} change for ${userId}:`, error);
      return { beforeUrl: null, afterUrl: null };
    }
  }

  /**
   * The stored URL of an asset, or null when it is not in storage. A stored
   * link is only valid once the bytes were captured, and an upload can
   * legitimately fail (Discord has usually invalidated the old hash by the
   * time the change is observed), so a computed URL alone would point at an
   * object that was never written.
   */
  private static async storedUrl(kind: MediaKind, userId: string, hash: string): Promise<string | null> {
    const [row] = await db
      .select({ hash: mediaSchema.hash })
      .from(mediaSchema)
      .where(and(eq(mediaSchema.userId, userId), eq(mediaSchema.kind, kind), eq(mediaSchema.hash, hash)));
    return row ? mediaUrl(kind, userId, hash) : null;
  }

  /**
   * Whether an asset's file is gone or due to be. An asset that was never
   * stored counts as expired, since there is no file to open either way.
   */
  public static async isExpired(
    kind: MediaKind,
    userId: string,
    hash: string,
    now: Date = new Date()
  ): Promise<boolean> {
    const [row] = await db
      .select({ expiresAt: mediaSchema.expiresAt, deletedAt: mediaSchema.deletedAt })
      .from(mediaSchema)
      .where(and(eq(mediaSchema.userId, userId), eq(mediaSchema.kind, kind), eq(mediaSchema.hash, hash)));
    return !row || row.deletedAt !== null || (row.expiresAt !== null && row.expiresAt <= now);
  }

  /**
   * Delete the stored file of every asset whose TTL has passed and stamp
   * `deletedAt`. The row is kept, and a file that fails to delete stays
   * unstamped so the next sweep retries it.
   *
   * @param now - the reference time; overridable for tests.
   */
  public static async deleteExpiredFiles(now: Date = new Date()): Promise<number> {
    const predicate = and(
      isNotNull(mediaSchema.expiresAt),
      lte(mediaSchema.expiresAt, now),
      isNull(mediaSchema.deletedAt)
    );
    const expired = await db.select({ filename: mediaSchema.filename }).from(mediaSchema).where(predicate);
    const deleted: string[] = [];
    for (const asset of expired) {
      if (await StorageService.deleteFile(StorageBucket.Media, asset.filename)) {
        deleted.push(asset.filename);
      }
    }
    if (deleted.length === 0) {
      return 0;
    }
    await db
      .update(mediaSchema)
      .set({ deletedAt: now })
      .where(and(predicate, inArray(mediaSchema.filename, deleted)));
    return deleted.length;
  }

  private static superseded(at: Date): Pick<typeof mediaSchema.$inferInsert, "supersededAt" | "expiresAt"> {
    return { supersededAt: at, expiresAt: new Date(at.getTime() + MEDIA_TTL_MS) };
  }

  private static async upload(options: StoreMediaOptions): Promise<number | null> {
    const filename = mediaKey(options.kind, options.userId, options.hash);
    try {
      const response = await fetch(options.sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) {
        return null;
      }
      const bytes = await response.arrayBuffer();
      const saved = await StorageService.saveFile(
        StorageBucket.Media,
        filename,
        bytes,
        assetContentType(assetExtension(options.hash))
      );
      return saved ? bytes.byteLength : null;
    } catch {
      // A hash can already be invalid if a change event raced the fetch;
      // that is a normal miss, not an error worth logging.
      return null;
    }
  }

  private static row(
    options: StoreMediaOptions,
    size: number,
    supersededAt: Date | null
  ): typeof mediaSchema.$inferInsert {
    return {
      userId: options.userId,
      kind: options.kind,
      hash: options.hash,
      filename: mediaKey(options.kind, options.userId, options.hash),
      extension: assetExtension(options.hash),
      size,
      supersededAt,
      expiresAt: supersededAt && MediaService.superseded(supersededAt).expiresAt,
    };
  }

  /**
   * Every user's live hash of a kind, for comparing in bulk without a query
   * per user.
   */
  public static async liveHashes(kind: MediaKind): Promise<Map<string, string>> {
    const rows = await db
      .select({ userId: mediaSchema.userId, hash: mediaSchema.hash })
      .from(mediaSchema)
      .where(and(eq(mediaSchema.kind, kind), isNull(mediaSchema.supersededAt)));
    return new Map(rows.map(row => [row.userId, row.hash]));
  }

  private static async liveHash(userId: string, kind: MediaKind): Promise<string | null> {
    const [row] = await db
      .select({ hash: mediaSchema.hash })
      .from(mediaSchema)
      .where(
        and(eq(mediaSchema.userId, userId), eq(mediaSchema.kind, kind), isNull(mediaSchema.supersededAt))
      );
    return row?.hash ?? null;
  }
}
