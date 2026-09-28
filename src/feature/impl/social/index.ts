import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import InteractionCommand from "./command/interaction/interaction.command";
import ReactCommand from "./command/react/react.command";

/**
 * The social feature: interaction commands (`/interaction`, `/react`).
 */
export default class SocialFeature extends Feature {
  constructor() {
    super(FeatureIds.Interaction);

    this.registerCommand(new InteractionCommand());
    this.registerCommand(new ReactCommand());
  }
}
