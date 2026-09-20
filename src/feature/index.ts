import type Feature from "./feature";
import InvitesFeature from "./impl/invites";
import LevelsFeature from "./impl/levels";
import SocialFeature from "./impl/social";
import StatsFeature from "./impl/stats";

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
