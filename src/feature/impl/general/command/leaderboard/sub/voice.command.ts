import LeaderboardManager from "@/leaderboard/index";
import type Leaderboard from "@/leaderboard/leaderboard";
import { LeaderboardId, type LeaderboardRow } from "@/leaderboard/leaderboard";
import { formatDuration } from "@/lib/time";
import LeaderboardSubCommand from "../leaderboard-subcommand";

export default class VoiceLeaderboardCommand extends LeaderboardSubCommand {
  constructor() {
    super({ id: "voice", displayName: "Show the server's voice-time leaderboard" });
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

  protected override renderValue(row: LeaderboardRow): string {
    return `**${formatDuration(row.value * 1000)}** voice time`;
  }
}
