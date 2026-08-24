import { eq } from "drizzle-orm";
import { db } from "../../db";
import { interactionProfiles } from "../../db/schema";
import Profile, { type ProfileScope } from "../../lib/profile/profile";
import type { InteractionType } from "./interaction-type";

export type InteractionData = Partial<Record<InteractionType, number>>;

export class InteractionProfile extends Profile<InteractionData> {
  public hugs: number = 0;

  protected override get scope(): ProfileScope {
    return "user";
  }

  protected override deserialize(raw: InteractionData): void {
    this.hugs = raw.hugs ?? 0;
  }

  protected override serialize(): InteractionData {
    return {
      hugs: this.hugs,
    };
  }

  protected override async fetch(): Promise<InteractionData | undefined> {
    return db
      .select()
      .from(interactionProfiles)
      .where(eq(interactionProfiles.globalUserId, this.key))
      .then((rows) => rows[0]?.data as InteractionData | undefined);
  }

  protected override async persist(raw: InteractionData): Promise<void> {
    await db
      .insert(interactionProfiles)
      .values({ globalUserId: this.key, data: raw })
      .onConflictDoUpdate({
        target: interactionProfiles.globalUserId,
        set: { data: raw, updatedAt: new Date() },
      });
  }
}