import { FeatureIds } from "../../feature-ids.ts";
import Feature from "../../feature.ts";
import InteractionCommand from "./command/interaction/interaction.command.ts";
import ReactCommand from "./command/react/react.command.ts";

export { default as SocialService, type InteractionType } from "./social.service";

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
