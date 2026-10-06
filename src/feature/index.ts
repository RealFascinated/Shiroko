import type Feature from "./feature";
import AutorolesFeature from "./impl/autoroles/index";
import BirthdayFeature from "./impl/birthday/index";
import FunFeature from "./impl/fun/index";
import GeneralFeature from "./impl/general/index";
import InvitesFeature from "./impl/invites/index";
import LevelsFeature from "./impl/levels/index";
import RemindersFeature from "./impl/reminders/index";
import SocialFeature from "./impl/social/index";
import StatsFeature from "./impl/stats/index";
import WelcomerFeature from "./impl/welcomer/index";

export default class FeatureManager {
  private static FEATURES: Feature[] = [];

  constructor() {
    FeatureManager.registerFeature(new GeneralFeature());
    FeatureManager.registerFeature(new StatsFeature());
    FeatureManager.registerFeature(new SocialFeature());
    FeatureManager.registerFeature(new InvitesFeature());
    FeatureManager.registerFeature(new LevelsFeature());
    FeatureManager.registerFeature(new BirthdayFeature());
    FeatureManager.registerFeature(new RemindersFeature());
    FeatureManager.registerFeature(new AutorolesFeature());
    FeatureManager.registerFeature(new WelcomerFeature());
    FeatureManager.registerFeature(new FunFeature());
  }

  public static registerFeature(feature: Feature): void {
    this.FEATURES.push(feature);
  }
}
