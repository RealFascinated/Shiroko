import Command from "../../../../command/command";
import LeaderboardCommand from "./sub/leaderboard.command";
import RankCommand from "./sub/rank.command";
import RewardsCommand from "./sub/rewards.command";

export default class LevelsCommand extends Command {
  constructor() {
    super("levels", "Levelling: rank and leaderboard");

    this.registerSubCommand(new RankCommand());
    this.registerSubCommand(new LeaderboardCommand());
    this.registerSubCommand(new RewardsCommand());
  }
}
