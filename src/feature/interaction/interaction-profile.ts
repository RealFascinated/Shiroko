import { eq } from "drizzle-orm";
import { db } from "../../db";
import { interactionProfiles } from "../../db/schema";
import Profile, { type ProfileScope } from "../../lib/profile/profile";

export type InteractionData = {
  hugs: Record<string, number>;
  kisses: Record<string, number>;
  slaps: Record<string, number>;
  pats: Record<string, number>;
};

export class InteractionProfile extends Profile<InteractionData> {
  public hugs: Map<string, number> = new Map();
  public kisses: Map<string, number> = new Map();
  public slaps: Map<string, number> = new Map();
  public pats: Map<string, number> = new Map();

  protected override get scope(): ProfileScope {
    return "user";
  }

  protected override deserialize(raw: InteractionData): void {
    this.hugs = new Map(Object.entries(raw.hugs ?? {}));
    this.kisses = new Map(Object.entries(raw.kisses ?? {}));
    this.slaps = new Map(Object.entries(raw.slaps ?? {}));
    this.pats = new Map(Object.entries(raw.pats ?? {}));
  }

  protected override serialize(): InteractionData {
    return {
      hugs: Object.fromEntries(this.hugs),
      kisses: Object.fromEntries(this.kisses),
      slaps: Object.fromEntries(this.slaps),
      pats: Object.fromEntries(this.pats),
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
