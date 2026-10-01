import { EventHandler } from "@/event/event-handler";
import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import PanelManager from "@/panel/index";
import GlobalUsersManager from "@/user/global-users-manager";
import { welcomerPanel } from "./command/welcomer/welcomer-panel";
import WelcomerCommand from "./command/welcomer/welcomer.command";
import { welcomerService } from "./welcomer.service";

export default class WelcomerFeature extends Feature {
  constructor() {
    super(FeatureIds.Welcomer, { defaultEnabled: false, name: "Welcomer", emoji: "👋" });

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
