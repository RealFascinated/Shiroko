import { db } from "@/db/index";
import { interactionsSchema } from "@/db/schemas/interactions";
import { sql } from "drizzle-orm";

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

export default class SocialService {
  public static async incrementInteraction(
    actorId: string,
    targetId: string,
    type: InteractionType
  ): Promise<number> {
    const [row] = await db
      .insert(interactionsSchema)
      .values({ actorId, targetId, type, count: 1 })
      .onConflictDoUpdate({
        target: [interactionsSchema.actorId, interactionsSchema.targetId, interactionsSchema.type],
        set: { count: sql`${interactionsSchema.count} + 1`, updatedAt: new Date() },
      })
      .returning({ count: interactionsSchema.count });

    return row!.count;
  }
}
