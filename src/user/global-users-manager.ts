import type { User } from "discord.js";
import { eq } from "drizzle-orm";
import { Cache } from "../cache/cache";
import { Caches } from "../cache/index";
import { userKey } from "../cache/key";
import { db } from "../db/index";
import { globalUsersSchema, type GlobalUserSchema } from "../db/schemas/global-users";
import GlobalUser from "./global-user";

/**
 * Global user rows, cached per user id. The cached value is the database
 * row, not the wrapper: `GlobalUser` carries the discord.js `User` it was
 * built from, and that object belongs to the caller, not the cache. The
 * cache is authoritative, so user data deletion purges by user scope.
 */
export default class GlobalUsersManager {
  private static readonly CACHE: Cache<GlobalUserSchema> = Caches.register(
    new Cache<GlobalUserSchema>({ name: "global-users", mode: "authoritative", max: 100_000 })
  );

  public static async getUser(user: User): Promise<GlobalUser> {
    const row = await GlobalUsersManager.CACHE.load(userKey(user.id), async () => {
      const [existing] = await db.select().from(globalUsersSchema).where(eq(globalUsersSchema.id, user.id));
      if (existing) {
        return existing;
      }
      const [inserted] = await db
        .insert(globalUsersSchema)
        .values({ id: user.id })
        .onConflictDoNothing({ target: globalUsersSchema.id })
        .returning();
      if (inserted) {
        console.log(`Created new global user for ${user.tag} (${user.id})`);
        return inserted;
      }
      const [row] = await db.select().from(globalUsersSchema).where(eq(globalUsersSchema.id, user.id));
      return row!;
    });
    return new GlobalUser(user, row);
  }
}
