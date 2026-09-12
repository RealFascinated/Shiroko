import InviteLeaderboard from "./impl/invite-leaderboard";
import LevelLeaderboard from "./impl/level-leaderboard";
import MessageLeaderboard from "./impl/message-leaderboard";
import VoiceLeaderboard from "./impl/voice-leaderboard";
import type Leaderboard from "./leaderboard";
import { LeaderboardId, type LeaderboardRow } from "./leaderboard";

/**
 * The registered leaderboards, keyed by id. This is a registry, not a
 * barrel: implementations are never re-exported, so consumers look a
 * board up here by id.
 */
export default class LeaderboardManager {
  private static BOARDS: Record<LeaderboardId, Leaderboard<LeaderboardRow>> = {
    [LeaderboardId.Level]: new LevelLeaderboard(),
    [LeaderboardId.Messages]: new MessageLeaderboard(),
    [LeaderboardId.Invites]: new InviteLeaderboard(),
    [LeaderboardId.Voice]: new VoiceLeaderboard(),
  };

  /**
   * Look up a registered leaderboard by its id. The registry is total
   * over {@link LeaderboardId}, so this never returns undefined.
   */
  public static getLeaderboard(id: LeaderboardId): Leaderboard<LeaderboardRow> {
    return LeaderboardManager.BOARDS[id];
  }

  /**
   * Every registered leaderboard, in registration order.
   */
  public static listLeaderboards(): Leaderboard<LeaderboardRow>[] {
    return Object.values(LeaderboardManager.BOARDS);
  }
}
