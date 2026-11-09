import { db } from "@/db/index";
import { interactionsSchema } from "@/db/schemas/interactions";
import type { InteractionType } from "./interactions";
import { sql } from "drizzle-orm";


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
