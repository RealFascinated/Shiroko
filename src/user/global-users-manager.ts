import type { User } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { globalUsers } from "../db/schema";
import GlobalUser from "./global-user";

export default class GlobalUsersManager {
  private static users: Map<string, GlobalUser> = new Map();

  /**
   * Get or create the global user for a Discord user.
   *
   * Returns the cached instance if present, otherwise loads the existing
   * `global_users` row or inserts a new one keyed by the user's id.
   *
   * @param user - The Discord user whose id is the lookup key.
   * @returns The global user instance.
   */
  public static async getUser(user: User): Promise<GlobalUser> {
    const cached = this.users.get(user.id);
    if (cached) {
      return cached;
    }

    const [existing] = await db.select().from(globalUsers).where(eq(globalUsers.id, user.id)).limit(1);

    if (!existing) {
      await db.insert(globalUsers).values({ id: user.id }).onConflictDoNothing({ target: globalUsers.id });
      console.log(`Created new global user for ${user.tag} (${user.id})`);
    }

    const globalUser = new GlobalUser(user.id, user);
    this.users.set(user.id, globalUser);
    return globalUser;
  }
}
