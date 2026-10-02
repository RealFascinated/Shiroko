import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import EightBallCommand from "./command/8ball.command";

export default class FunFeature extends Feature {
  constructor() {
    super(FeatureIds.Fun, { name: "Fun", emoji: "🎉" });

    this.registerCommand(new EightBallCommand());
  }
}
