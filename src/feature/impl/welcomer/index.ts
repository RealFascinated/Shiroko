import { EventHandler } from "@/event/event-handler";
import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import PanelManager from "@/panel/index";
import GlobalUsersManager from "@/user/global-users-manager";
import WelcomerCommand from "./command/welcomer.command";
import { welcomerPanel } from "./welcomer-panel";
import { welcomerService } from "./welcomer.service";

/**
 * The welcomer feature: `/welcomer` and the join announcement. Its panel is
 * registered with the generic panel engine, which owns the component
 * routing; the feature only declares the panel and consumes the membership
 * event.
 */
export default class WelcomerFeature extends Feature {
  constructor() {
    super(FeatureIds.Welcomer, { defaultEnabled: false });

    PanelManager.register(welcomerPanel);
    this.registerCommand(new WelcomerCommand());
  }

  /**
   * Send the welcome message to a member who just joined.
   */
  @EventHandler(MemberGuildJoinEvent, { featureId: FeatureIds.Welcomer })
  public async onMemberGuildJoin(event: MemberGuildJoinEvent): Promise<void> {
    const globalUser = await GlobalUsersManager.getUser(event.member.user);
    await welcomerService.announce(event.member.guild, event.member, globalUser);
  }
}
