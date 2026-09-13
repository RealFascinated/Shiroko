import Command from "../../../command/command";
import InvitesLeaderboardCommand from "./sub/invites.command";
import LevelLeaderboardCommand from "./sub/level.command";
import MessagesLeaderboardCommand from "./sub/messages.command";
import VoiceLeaderboardCommand from "./sub/voice.command";

/**
 * Show the server's leaderboards via subcommands.
 */
export default class LeaderboardCommand extends Command {
  constructor() {
    super("leaderboard", "Show the server's leaderboards");
    this.registerSubCommand(new LevelLeaderboardCommand());
    this.registerSubCommand(new MessagesLeaderboardCommand());
    this.registerSubCommand(new InvitesLeaderboardCommand());
    this.registerSubCommand(new VoiceLeaderboardCommand());
  }
}
