import type Feature from "./feature";
import InvitesFeature from "./invites";
import LevelsFeature from "./levels";
import SocialFeature from "./social";
import StatsFeature from "./stats";

export default class FeatureManager {
  private static FEATURES: Feature[] = [];

  constructor() {
    FeatureManager.registerFeature(new StatsFeature());
    FeatureManager.registerFeature(new SocialFeature());
    FeatureManager.registerFeature(new InvitesFeature());
    FeatureManager.registerFeature(new LevelsFeature());
  }

  public static registerFeature(feature: Feature): void {
    this.FEATURES.push(feature);
  }
}
