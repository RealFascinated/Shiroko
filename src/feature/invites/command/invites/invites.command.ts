import Command from "../../../../command/command";
import LeaderboardCommand from "./sub/leaderboard.command";
import UserCommand from "./sub/user.command";

/**
 * Show invite stats: who you (or another user) invited, or the server's
 * invite leaderboard. Guild-only, since invite tracking is per-guild.
 */
export default class InvitesCommand extends Command {
  constructor() {
    super("invites", "Show invite stats");
    this.registerSubCommand(new UserCommand());
    this.registerSubCommand(new LeaderboardCommand());
  }
}
