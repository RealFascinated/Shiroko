import type { ComponentSchema } from "@/db/schemas/components";
import type { JsonValue } from "@/db/schemas/guild-settings";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/index";
import { componentsSchema } from "../db/schemas/components";

export interface ComponentInput {
  /** Null for a component on a DM reply, which a user-installable command can produce. */
  guildId: string | null;
  channelId: string | null;
  messageId: string;
  /** The only user allowed to press, or null when anyone may. */
  userId: string | null;
  type: string;
  extraData: JsonValue;
  expiresAt: Date | null;
}

/**
 * The stored components, one row per interactive control on a message.
 * Rows are the whole of a component's state: nothing about a press lives in
 * process memory, so a restart cannot lose a component's behaviour, only
 * leave rows that later expire.
 */
export default class Components {
  /**
   * Store a component and hand back its new row, whose id is the one a
   * custom id must carry. The id is minted here rather than by the caller,
   * and is version 7 so the primary key indexes in press order and a
   * `max(id)` is the newest component.
   */
  public static async create(input: ComponentInput): Promise<ComponentSchema> {
    const [row] = await db
      .insert(componentsSchema)
      .values({ ...input, id: Bun.randomUUIDv7() })
      .returning();
    return row!;
  }

  /** The live row for an id, or null when it is unknown or expired. */
  public static async find(id: string): Promise<ComponentSchema | null> {
    const [row] = await db
      .select()
      .from(componentsSchema)
      .where(and(eq(componentsSchema.id, id), Components.live()));
    return row ?? null;
  }

  /**
   * Atomically claim a one-shot row: the row is deleted and returned only
   * for the writer that won, so two presses racing on one button run its
   * handler exactly once. An expired row is not claimable.
   */
  public static async consume(id: string): Promise<ComponentSchema | null> {
    const [row] = await db
      .delete(componentsSchema)
      .where(and(eq(componentsSchema.id, id), Components.live()))
      .returning();
    return row ?? null;
  }

  /** Drop every component of a message, e.g. once a one-shot press lands. */
  public static async deleteByMessage(messageId: string): Promise<void> {
    await db.delete(componentsSchema).where(eq(componentsSchema.messageId, messageId));
  }

  private static live(): ReturnType<typeof or> {
    return or(isNull(componentsSchema.expiresAt), gt(componentsSchema.expiresAt, sql`now()`))!;
  }
}
