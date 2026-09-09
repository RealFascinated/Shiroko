import SocialFeature from "./social";
import StatsFeature from "./stats";

export default class FeatureManager {
  
  constructor() {
    new StatsFeature();
    new SocialFeature();
  }
}