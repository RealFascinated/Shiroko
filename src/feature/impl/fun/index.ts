import ComponentManager from "@/component/index";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import EightBallCommand from "./command/8ball.command";
import CoinflipCommand from "./command/coinflip.command";
import RollCommand from "./command/roll.command";
import TriviaCommand from "./command/trivia.command";
import TriviaHintComponent from "./trivia-hint.component";

export default class FunFeature extends Feature {
  constructor() {
    super(FeatureIds.Fun, { name: "Fun", emoji: "🎉" });

    this.registerCommand(new EightBallCommand());
    this.registerCommand(new CoinflipCommand());
    this.registerCommand(new RollCommand());
    this.registerCommand(new TriviaCommand());
    ComponentManager.register(new TriviaHintComponent());
  }
}
