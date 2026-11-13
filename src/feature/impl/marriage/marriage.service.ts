import { db } from "@/db/index";
import { guildMarriagesSchema } from "@/db/schemas/guild-marriages";
import { and, eq } from "drizzle-orm";

export interface Marriage {
  partnerId: string;
  marriedAt: Date;
}

class MarriageService {
  public async getMarriage(guildId: string, userId: string): Promise<Marriage | null> {
    const [row] = await db
      .select()
      .from(guildMarriagesSchema)
      .where(and(eq(guildMarriagesSchema.guildId, guildId), eq(guildMarriagesSchema.userId, userId)));
    return row ? { partnerId: row.partnerId, marriedAt: row.marriedAt } : null;
  }

  /** `false` when either spouse already married someone in this guild meanwhile. */
  public async marry(guildId: string, a: string, b: string): Promise<boolean> {
    return db.transaction(async tx => {
      const rows = await tx
        .insert(guildMarriagesSchema)
        .values([
          { guildId, userId: a, partnerId: b },
          { guildId, userId: b, partnerId: a },
        ])
        .onConflictDoNothing()
        .returning();
      if (rows.length === 2) {
        return true;
      }
      tx.rollback();
      return false;
    });
  }

  /** The former partner's id, or `null` when the member was not married. */
  public async divorce(guildId: string, userId: string): Promise<string | null> {
    const marriage = await this.getMarriage(guildId, userId);
    if (!marriage) {
      return null;
    }
    await db
      .delete(guildMarriagesSchema)
      .where(and(eq(guildMarriagesSchema.guildId, guildId), eq(guildMarriagesSchema.userId, userId)));
    await db
      .delete(guildMarriagesSchema)
      .where(
        and(eq(guildMarriagesSchema.guildId, guildId), eq(guildMarriagesSchema.userId, marriage.partnerId))
      );
    return marriage.partnerId;
  }
}

export const marriageService = new MarriageService();
