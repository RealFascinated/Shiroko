import { and, eq, isNotNull, isNull, lt, ne } from "drizzle-orm";
import { db } from "../db/index";
import { mediaSchema } from "../db/schemas/media";
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
  /** The Discord user the asset belongs to. */
  readonly userId: string;
  readonly kind: MediaKind;
  /** Discord's asset hash, including the `a_` prefix when animated. */
  readonly hash: string;
  /** The live Discord CDN URL the bytes are fetched from. */
  readonly sourceUrl: string;
}

/** How long a superseded asset is kept before the sweep removes it. */
export const MEDIA_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The nightly media sweep: delete every superseded avatar and banner whose
 * TTL has passed.
 *
 * Never rejects. `Bun.cron` turns a rejected promise into an
 * `unhandledRejection`, which exits the process without a handler, so the
 * body is guarded the way the birthday sweep is.
 */
export async function runMediaSweep(now: Date = new Date()): Promise<void> {
  try {
    const removed = await MediaService.expireSuperseded(now);
    if (removed > 0) {
      console.log(`Expired ${removed} media asset(s) past the ${MEDIA_TTL_MS / 86_400_000}-day TTL`);
    }
  } catch (error) {
    console.error("Media sweep failed:", error);
  }
}

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
      .set({ supersededAt: new Date() })
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
        set: { size, supersededAt: null },
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
      .set({ supersededAt: new Date() })
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
   * Delete every superseded asset whose TTL has passed, object and row
   * alike. Objects are deleted before their rows, so a failed object
   * deletion leaves the row in place to retry on the next sweep instead of
   * orphaning the bytes.
   *
   * @param now - the reference time; overridable for tests.
   */
  public static async expireSuperseded(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - MEDIA_TTL_MS);
    const predicate = and(isNotNull(mediaSchema.supersededAt), lt(mediaSchema.supersededAt, cutoff));

    const expired = await db
      .select({ userId: mediaSchema.userId, kind: mediaSchema.kind, filename: mediaSchema.filename })
      .from(mediaSchema)
      .where(predicate);
    for (const asset of expired) {
      await StorageService.deleteFile(StorageBucket.Media, asset.filename);
    }
    if (expired.length === 0) {
      return 0;
    }
    await db.delete(mediaSchema).where(predicate);
    return expired.length;
  }

  private static async upload(options: StoreMediaOptions): Promise<number | null> {
    const filename = mediaKey(options.kind, options.userId, options.hash);
    try {
      const response = await fetch(options.sourceUrl);
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
    };
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
