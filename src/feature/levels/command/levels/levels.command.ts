import Command from "../../../../command/command";
import ConfigCommand from "./sub/config.command";
import LeaderboardCommand from "./sub/leaderboard.command";
import RankCommand from "./sub/rank.command";

export default class LevelsCommand extends Command {
  constructor() {
    super("levels", "Levelling: rank, leaderboard, and server configuration");

    this.registerSubCommand(new RankCommand());
    this.registerSubCommand(new LeaderboardCommand());
    this.registerSubCommand(new ConfigCommand());
  }
}
