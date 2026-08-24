import type { User } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { globalUsers } from "../db/schema";
import GlobalUser from "./global-user";

export default class GlobalUsersManager {
  private static users: Map<string, GlobalUser> = new Map();

  constructor() {
    setInterval(() => {
      void GlobalUsersManager.saveAllProfiles();
    }, 60_000);
  }

  /**
   * Persist every cached user's profiles, awaiting each save before returning.
   *
   * Blocks until all saves settle (or error), so callers can await it on
   * graceful shutdown to avoid losing in-memory changes.
   */
  public static async saveAllProfiles(): Promise<void> {
    let savedCount = 0;
    for (const user of GlobalUsersManager.users.values()) {
      try {
        savedCount += await user.saveProfiles();
      } catch (err) {
        console.error(`Failed to save profiles for global user ${user.id}:`, err);
      }
    }
    if (savedCount > 0) {
      console.log(`Saved profiles for ${savedCount} global users.`);
    }
  }

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

    const [existing] = await db
      .select()
      .from(globalUsers)
      .where(eq(globalUsers.id, user.id))
      .limit(1);

    if (!existing) {
      await db
        .insert(globalUsers)
        .values({ id: user.id })
        .onConflictDoNothing({ target: globalUsers.id });
      console.log(`Created new global user for ${user.tag} (${user.id})`);
    }

    const globalUser = new GlobalUser(user.id, user);
    this.users.set(user.id, globalUser);
    return globalUser;
  }
}
