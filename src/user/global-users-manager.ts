import type { User } from "discord.js";
import { db } from "../db/index";
import { globalUsers } from "../db/schema";
import GlobalUser from "./global-user";

export default class GlobalUsersManager {

  public static async getUser(user: User): Promise<GlobalUser> {
    const [inserted] = await db
      .insert(globalUsers)
      .values({ id: user.id })
      .onConflictDoNothing({ target: globalUsers.id })
      .returning();

    if (inserted) {
      console.log(`Created new global user for ${user.tag} (${user.id})`);
    }
    return new GlobalUser(user.id, user);
  }
}