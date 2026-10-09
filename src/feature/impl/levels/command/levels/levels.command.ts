import Command from "@/command/command";
import RankCommand from "./sub/rank.command";
import RewardAddCommand from "./sub/reward-add.command";
import RewardRemoveCommand from "./sub/reward-remove.command";
import RewardsCommand from "./sub/rewards.command";
import SyncRewardsCommand from "./sub/sync-rewards.command";

export default class LevelsCommand extends Command {
  constructor() {
    super({ id: "levels", displayName: "Levelling: rank and rewards" });

    this.registerSubCommand(new RankCommand());
    this.registerSubCommand(new RewardsCommand());
    this.registerSubCommand(new RewardAddCommand());
    this.registerSubCommand(new RewardRemoveCommand());
    this.registerSubCommand(new SyncRewardsCommand());
  }
}
