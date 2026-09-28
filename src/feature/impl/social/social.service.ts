import { sql } from "drizzle-orm";
import { db } from "../../../db/index";
import { interactions } from "../../../db/schemas/interactions";

export type InteractionType =
  | "hug"
  | "kiss"
  | "slap"
  | "pat"
  | "cuddle"
  | "dance"
  | "feed"
  | "headpat"
  | "holdhands"
  | "poke"
  | "wink"
  | "tease"
  | "tickle"
  | "bonk"
  | "blowkiss"
  | "bite";

/**
 * Increments the interaction count from `actorId` to `targetId` and
 * returns the new count.
 */
export default class SocialService {
  public static async incrementInteraction(
    actorId: string,
    targetId: string,
    type: InteractionType
  ): Promise<number> {
    const [row] = await db
      .insert(interactions)
      .values({ actorId, targetId, type, count: 1 })
      .onConflictDoUpdate({
        target: [interactions.actorId, interactions.targetId, interactions.type],
        set: { count: sql`${interactions.count} + 1`, updatedAt: new Date() },
      })
      .returning({ count: interactions.count });

    return row!.count;
  }
}
