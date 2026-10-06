import { db } from "@/db/index";
import { commandCallsSchema } from "@/db/schemas/command-calls";
import { sql } from "drizzle-orm";

/**
 * Persistent tally of slash-command invocations, keyed by the top-level
 * command id. Reads run against the `command_calls` table through
 * {@link totals}/{@link total}; the listener records through
 * {@link record}.
 */
export default class CommandCallService {
  /**
   * Add one invocation of `command`. Never throws: a metrics write must
   * not be able to fail a command, so a database error is logged and
   * dropped.
   */
  public static async record(command: string): Promise<void> {
    try {
      await db
        .insert(commandCallsSchema)
        .values({ command, count: 1 })
        .onConflictDoUpdate({
          target: commandCallsSchema.command,
          set: { count: sql`${commandCallsSchema.count} + 1` },
        });
    } catch (error) {
      console.error(`Failed to record command call "${command}":`, error);
    }
  }

  /**
   * Total invocations per top-level command, for the `command_calls_total` series.
   */
  public static async totals(): Promise<Record<string, number>> {
    const rows = await db
      .select({ command: commandCallsSchema.command, count: sql<number>`sum(${commandCallsSchema.count})` })
      .from(commandCallsSchema)
      .groupBy(commandCallsSchema.command);
    return Object.fromEntries(rows.map(row => [row.command, Number(row.count)]));
  }

  /**
   * Total invocations across every command, for `/botstats`.
   */
  public static async total(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`sum(${commandCallsSchema.count})` })
      .from(commandCallsSchema);
    return Number(row?.count ?? 0);
  }
}
