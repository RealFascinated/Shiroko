import LeaderboardManager from "../../../../leaderboard";
import type Leaderboard from "../../../../leaderboard/leaderboard";
import { LeaderboardId, type LeaderboardRow } from "../../../../leaderboard/leaderboard";
import { ordinal, pluralise } from "../../../../lib/format";
import LeaderboardSubCommand from "./leaderboard-subcommand";

/**
 * Show the server's total message-count leaderboard, most messages first.
 */
export default class MessagesLeaderboardCommand extends LeaderboardSubCommand {
  constructor() {
    super("messages", "Show the server's total message-count leaderboard");
  }

  public override get board(): Leaderboard<LeaderboardRow> {
    return LeaderboardManager.getLeaderboard(LeaderboardId.Messages);
  }

  public override get title(): string {
    return "💬 Messages Leaderboard";
  }

  public override get emptyMessage(): string {
    return "No messages tracked in this server yet.";
  }

  protected override renderRow(row: LeaderboardRow, position: number): string {
    return `**${ordinal(position)}.** <@${row.id}>: **${row.value.toLocaleString("en-US")}** ${pluralise(row.value, "message")}`;
  }
}
