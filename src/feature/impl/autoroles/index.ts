import { EventHandler } from "@/event/event-handler";
import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import SettingsManager from "@/settings/index";
import { autorolesSettings } from "./autoroles-settings";
import { autorolesService } from "./autoroles.service";
import AutorolesCommand from "./command/autoroles/autoroles.command";

/**
 * The autoroles feature: `/autoroles` plus the on-join grant. Granting runs
 * through a `@EventHandler` on `MemberGuildJoinEvent`, gated by the
 * feature's toggle so a disabled guild does no work.
 */
export default class AutorolesFeature extends Feature {
  constructor() {
    super(FeatureIds.Autoroles, { defaultEnabled: false, name: "Autoroles", emoji: "🎭" });

    SettingsManager.register(autorolesSettings);
    this.registerCommand(new AutorolesCommand());
  }

  @EventHandler(MemberGuildJoinEvent, { featureId: FeatureIds.Autoroles })
  public async onMemberGuildJoin(event: MemberGuildJoinEvent): Promise<void> {
    await autorolesService.applyToMember(event.member.guild, event.member);
  }
}
