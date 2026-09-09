import { discordClient } from "..";
import type Feature from "./feature";
import InvitesFeature from "./invites";
import SocialFeature from "./social";
import StatsFeature from "./stats";

export default class FeatureManager {
  private static FEATURES: Feature[] = [];

  constructor() {
    FeatureManager.registerFeature(new StatsFeature());
    FeatureManager.registerFeature(new SocialFeature());
    FeatureManager.registerFeature(new InvitesFeature());

    FeatureManager.FEATURES.forEach((feature) => feature.registerHandlers(discordClient));
  }

  public static registerFeature(feature: Feature): void {
    this.FEATURES.push(feature);
  }
}
