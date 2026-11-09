import AutorolesFeature from "./impl/autoroles/index";
import BirthdayFeature from "./impl/birthday/index";
import FunFeature from "./impl/fun/index";
import GeneralFeature from "./impl/general/index";
import InvitesFeature from "./impl/invites/index";
import LevelsFeature from "./impl/levels/index";
import LoggingFeature from "./impl/logging/index";
import RemindersFeature from "./impl/reminders/index";
import SocialFeature from "./impl/social/index";
import StatsFeature from "./impl/stats/index";
import WelcomerFeature from "./impl/welcomer/index";

/**
 * Constructs every feature. Registration of commands, settings, panels and
 * event handlers is a side effect of construction, so this is the one list
 * of what the bot is made of.
 */
export default function registerFeatures(): void {
  new GeneralFeature();
  new StatsFeature();
  new SocialFeature();
  new InvitesFeature();
  new LevelsFeature();
  new BirthdayFeature();
  new RemindersFeature();
  new AutorolesFeature();
  new WelcomerFeature();
  new FunFeature();
  new LoggingFeature();
}
