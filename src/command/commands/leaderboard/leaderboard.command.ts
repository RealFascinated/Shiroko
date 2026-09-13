import Command from "../../../command/command";
import MessagesLeaderboardCommand from "./sub/messages.command";

/**
 * Show the server's leaderboards via subcommands.
 */
export default class LeaderboardCommand extends Command {
  constructor() {
    super("leaderboard", "Show the server's leaderboards");
    this.registerSubCommand(new MessagesLeaderboardCommand());
  }
}
