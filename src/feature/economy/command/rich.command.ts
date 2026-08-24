import { desc, sql } from "drizzle-orm";
import Command, { type ExecuteContext } from "../../../command/command";
import { db } from "../../../db";
import { userEconomy } from "../../../db/schema";
import { baseEmbed } from "../../../lib/embed";

/** Leaderboard rank prefixes: medals for the top 3, plain numbers beyond. */
const RANK_PREFIXES: Record<number, string> = {
  0: "🥇",
  1: "🥈",
  2: "🥉",
};

/**
 * Global leaderboard of the richest rune holders (wallet + bank combined).
 */
export default class RichCommand extends Command {
  constructor() {
    super("rich", "See the richest rune holders");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx }: ExecuteContext) {
    const top = await db
      .select({
        userId: userEconomy.userId,
        total: sql`${userEconomy.wallet} + ${userEconomy.bank}`.mapWith(Number),
      })
      .from(userEconomy)
      .orderBy(desc(sql`${userEconomy.wallet} + ${userEconomy.bank}`))
      .limit(10);

    if (top.length === 0) {
      return ctx.reply("No one holds any runes yet. Be the first!");
    }

    const lines = top.map((row, i) => {
      const prefix = RANK_PREFIXES[i] ?? `${i + 1}.`;
      return `${prefix} <@${row.userId}> — **${row.total} runes**`;
    });

    const embed = baseEmbed().setTitle("Richest Rune Holders").setDescription(lines.join("\n"));
    return ctx.reply({ embeds: [embed] });
  }
}
