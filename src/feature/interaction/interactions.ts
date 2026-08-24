import { sql } from "drizzle-orm";
import { db } from "../../db";
import { interactions } from "../../db/schema";

export type InteractionType =
  "hug" | "kiss" | "slap" | "pat" | "cuddle" | "dance" | "feed" | "headpat" | "holdhands" | "poke";

/**
 * Increment the interaction count from `actorId` to `targetId` and return the new count.
 *
 * @param actorId - The global user id performing the interaction.
 * @param targetId - The global user id receiving the interaction.
 * @param type - The interaction type.
 * @returns The new interaction count.
 */
export async function incrementInteraction(
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
