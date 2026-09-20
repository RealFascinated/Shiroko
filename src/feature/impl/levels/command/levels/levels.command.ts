import Command from "../../../../../command/command";
import RankCommand from "./sub/rank.command";
import RewardsCommand from "./sub/rewards.command";

export default class LevelsCommand extends Command {
  constructor() {
    super("levels", "Levelling: rank and rewards");

    this.registerSubCommand(new RankCommand());
    this.registerSubCommand(new RewardsCommand());
  }
}
