import { levelForXp } from "../../../../feature/impl/levels/xp";
import LeaderboardManager from "../../../../leaderboard";
import type Leaderboard from "../../../../leaderboard/leaderboard";
import { LeaderboardId, type LeaderboardRow } from "../../../../leaderboard/leaderboard";
import { ordinal } from "../../../../lib/format";
import LeaderboardSubCommand from "./leaderboard-subcommand";

/**
 * Show the server's levelling leaderboard, most XP first.
 */
export default class LevelLeaderboardCommand extends LeaderboardSubCommand {
  constructor() {
    super("level", "Show the server's levelling leaderboard");
  }

  public override get board(): Leaderboard<LeaderboardRow> {
    return LeaderboardManager.getLeaderboard(LeaderboardId.Level);
  }

  public override get title(): string {
    return "📊 Levelling Leaderboard";
  }

  public override get emptyMessage(): string {
    return "No tracked levels in this server yet.";
  }

  protected override renderRow(row: LeaderboardRow, position: number): string {
    return `**${ordinal(position)}.** <@${row.id}>: **${levelForXp(row.value)}** (${row.value.toLocaleString("en-US")} XP)`;
  }
}
