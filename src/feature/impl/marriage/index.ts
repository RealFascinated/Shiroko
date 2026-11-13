import ComponentManager from "@/component/index";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import MarriageCommand from "./command/marriage/marriage.command";
import MarriageResponseComponent from "./marriage-response.component";

export default class MarriageFeature extends Feature {
  constructor() {
    super(FeatureIds.Marriage, { name: "Marriage", emoji: "💍" });

    ComponentManager.register(new MarriageResponseComponent());
    this.registerCommand(new MarriageCommand());
  }
}
