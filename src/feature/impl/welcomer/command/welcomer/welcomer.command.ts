import Command, { type ExecuteContext } from "@/command/command";
import { renderPanel } from "@/panel/render";
import { PermissionFlags } from "@/permission/permissions";
import { welcomerPanel } from "./welcomer-panel";

/**
 * Open the welcomer panel: the welcome message, its controls, and a live
 * preview.
 */
export default class WelcomerCommand extends Command {
  constructor() {
    super({ id: "welcomer", displayName: "Configure the message sent when members join" });
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.WELCOMER_ADMIN;
  }

  public override get userInstallable(): boolean {
    return false;
  }

  protected override async onExecuteSlash({ ctx, user }: ExecuteContext) {
    return ctx.reply(await renderPanel(welcomerPanel, { guild: ctx.guild!, user }, "welcome"));
  }
}
