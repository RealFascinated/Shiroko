import type { ComponentSchema } from "@/db/schemas/components";
import type { JsonValue } from "@/db/schemas/guild-settings";
import { and, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db/index";
import { componentsSchema } from "../db/schemas/components";

export interface ComponentInput {
  /** Pre-minted with `Components.newId`, when the custom id must exist before the message is sent. */
  id?: string;
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
   * Version 7 so the primary key indexes in press order and a `max(id)` is
   * the newest component.
   */
  public static newId(): string {
    return Bun.randomUUIDv7();
  }

  /**
   * Store a component and hand back its new row, whose id is the one a
   * custom id must carry. Minted here unless the caller pre-minted one with
   * `newId`, which a component sent with its message needs: the message id
   * the row stores does not exist until the send returns.
   */
  public static async create(input: ComponentInput): Promise<ComponentSchema> {
    const [row] = await db
      .insert(componentsSchema)
      .values({ ...input, id: input.id ?? Components.newId() })
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

  /**
   * Drop every component of a message, e.g. once a one-shot press lands, and
   * return what was deleted. An empty result means another caller already
   * dropped them, which makes this a claim on ending the message.
   */
  public static async deleteByMessage(messageId: string): Promise<ComponentSchema[]> {
    return db.delete(componentsSchema).where(eq(componentsSchema.messageId, messageId)).returning();
  }

  public static async deleteExpired(): Promise<ComponentSchema[]> {
    return db
      .delete(componentsSchema)
      .where(and(isNotNull(componentsSchema.expiresAt), lte(componentsSchema.expiresAt, sql`now()`)))
      .returning();
  }

  private static live(): ReturnType<typeof or> {
    return or(isNull(componentsSchema.expiresAt), gt(componentsSchema.expiresAt, sql`now()`))!;
  }
}
