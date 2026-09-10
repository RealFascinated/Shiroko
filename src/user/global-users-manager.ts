import type { User } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { globalUsers } from "../db/schema";
import GlobalUser from "./global-user";

export default class GlobalUsersManager {
  private static CACHE = new Map<string, GlobalUser>();

  /**
   * Get (creating if needed) the global user for `user`, memoized per
   * process. Event listeners resolve context through this so repeated
   * events (e.g. per-message) never re-query the DB.
   */
  public static async getCached(user: User): Promise<GlobalUser> {
    const cached = GlobalUsersManager.CACHE.get(user.id);
    if (cached) {
      return cached;
    }
    const globalUser = await GlobalUsersManager.getUser(user);
    GlobalUsersManager.CACHE.set(user.id, globalUser);
    return globalUser;
  }

  public static async getUser(user: User): Promise<GlobalUser> {
    const [existing] = await db.select().from(globalUsers).where(eq(globalUsers.id, user.id));

    if (existing) {
      return new GlobalUser(user, existing);
    }

    const [inserted] = await db
      .insert(globalUsers)
      .values({ id: user.id })
      .onConflictDoNothing({ target: globalUsers.id })
      .returning();

    if (inserted) {
      console.log(`Created new global user for ${user.tag} (${user.id})`);
      return new GlobalUser(user, inserted);
    }

    const [row] = await db.select().from(globalUsers).where(eq(globalUsers.id, user.id));
    return new GlobalUser(user, row!);
  }
}
