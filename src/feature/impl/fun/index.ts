import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import EightBallCommand from "./command/8ball.command";
import CoinflipCommand from "./command/coinflip.command";
import RollCommand from "./command/roll.command";

export default class FunFeature extends Feature {
  constructor() {
    super(FeatureIds.Fun, { name: "Fun", emoji: "🎉" });

    this.registerCommand(new EightBallCommand());
    this.registerCommand(new CoinflipCommand());
    this.registerCommand(new RollCommand());
  }
}
