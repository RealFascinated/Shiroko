import type Feature from "./feature";
import BirthdayFeature from "./impl/birthday/index";
import InvitesFeature from "./impl/invites/index";
import LevelsFeature from "./impl/levels/index";
import SocialFeature from "./impl/social/index";
import StatsFeature from "./impl/stats/index";

export default class FeatureManager {
  private static FEATURES: Feature[] = [];

  constructor() {
    FeatureManager.registerFeature(new StatsFeature());
    FeatureManager.registerFeature(new SocialFeature());
    FeatureManager.registerFeature(new InvitesFeature());
    FeatureManager.registerFeature(new LevelsFeature());
    FeatureManager.registerFeature(new BirthdayFeature());
  }

  public static registerFeature(feature: Feature): void {
    this.FEATURES.push(feature);
  }
}
