import Command, { type ExecuteContext } from "@/command/command";
import { renderPanel, renderPanelEmbeds } from "@/panel/render";
import { PermissionFlags } from "@/permission/permissions";
import { welcomerPanel } from "./welcomer-panel";

/**
 * Open the welcomer panel: the welcome message, its controls, and a live
 * preview. The preview of an embed message is a real embed, so it is sent
 * as its own message below the panel.
 */
export default class WelcomerCommand extends Command {
  constructor() {
    super({ id: "welcomer", displayName: "Configure the message sent when members join" });
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.WELCOMER_COMMAND;
  }

  public override get userInstallable(): boolean {
    return false;
  }

  protected override async onExecuteSlash({ ctx, user }: ExecuteContext) {
    const guild = ctx.guild!;
    const context = { guild, user };
    const reply = await ctx.reply(await renderPanel(welcomerPanel, context, "welcome"));
    const embeds = await renderPanelEmbeds(welcomerPanel, context, "welcome");
    if (embeds.length === 0) {
      return reply;
    }
    // The preview carries a resolved {user_mention}, so it must not ping.
    const preview = await ctx.followUp({ embeds, allowedMentions: { parse: [] } });
    welcomerPanel.rememberEmbedMessage(guild, preview.id);
    return reply;
  }
}
