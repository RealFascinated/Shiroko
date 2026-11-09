import { index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Stored media files, one row per object in the `arona-media` bucket.
 *
 * The primary key is the asset identity Discord already gives us: a user's
 * asset of a kind is content-addressed by its hash, so re-storing the same
 * bytes is an upsert, not a duplicate. The live asset for a `(userId, kind)`
 * pair is the row whose `supersededAt` is null; every earlier row is a
 * previous version whose file the sweep deletes from storage once it
 * expires. The row itself is kept forever: the hash and sizes outlive the
 * file so the audit log can still say what the asset was.
 *
 * `userId` is deliberately not a foreign key: media is a self-contained
 * store, and tying it to `global_users` would
 * mint a global user just because someone changed their avatar. The same
 * shape serves non-user attachments later.
 */
export const mediaSchema = pgTable(
  "media",
  {
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    hash: text("hash").notNull(),
    filename: text("filename").notNull(),
    extension: text("extension").notNull(),
    size: integer("size").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    /** When this asset stopped being the user's current one; null when live. */
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    /** When the file is due for deletion from storage; null for a live asset. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** When the file was deleted from storage; null while it still exists. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  table => [
    primaryKey({ columns: [table.userId, table.kind, table.hash] }),
    index("media_expires_idx").on(table.expiresAt),
  ]
);

export type MediaSchema = typeof mediaSchema.$inferSelect;
