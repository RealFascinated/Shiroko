import LeaderboardManager from "@/leaderboard/index";
import type Leaderboard from "@/leaderboard/leaderboard";
import { LeaderboardId, type LeaderboardRow } from "@/leaderboard/leaderboard";
import { pluralise } from "@/lib/format";
import LeaderboardSubCommand from "../leaderboard-subcommand";

export default class MessagesLeaderboardCommand extends LeaderboardSubCommand {
  constructor() {
    super({ id: "messages", displayName: "Show the server's total message-count leaderboard" });
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

  protected override renderValue(row: LeaderboardRow): string {
    return `**${row.value.toLocaleString("en-US")}** ${pluralise(row.value, "message")}`;
  }
}
