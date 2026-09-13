import LeaderboardManager from "../../../../leaderboard";
import type Leaderboard from "../../../../leaderboard/leaderboard";
import { LeaderboardId, type LeaderboardRow } from "../../../../leaderboard/leaderboard";
import { ordinal } from "../../../../lib/format";
import { formatDuration } from "../../../../lib/time";
import LeaderboardSubCommand from "./leaderboard-subcommand";

/**
 * Show the server's voice-time leaderboard, most completed voice time first.
 */
export default class VoiceLeaderboardCommand extends LeaderboardSubCommand {
  constructor() {
    super("voice", "Show the server's voice-time leaderboard");
  }

  public override get board(): Leaderboard<LeaderboardRow> {
    return LeaderboardManager.getLeaderboard(LeaderboardId.Voice);
  }

  public override get title(): string {
    return "🎧 Voice Time Leaderboard";
  }

  public override get emptyMessage(): string {
    return "No voice time tracked in this server yet.";
  }

  protected override renderRow(row: LeaderboardRow, position: number): string {
    return `**${ordinal(position)}.** <@${row.id}>: **${formatDuration(row.value * 1000)}** voice time`;
  }
}
