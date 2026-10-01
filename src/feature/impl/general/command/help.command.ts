import Command, { type ExecuteContext } from "@/command/command";
import { renderPanel } from "@/panel/render";
import { helpPanel } from "../help-panel";

/**
 * Show the bot's commands grouped by feature. The panel is read-only; its
 * automatic view switcher is the feature dropdown, and each view lists that
 * feature's commands and sub-commands.
 */
export default class HelpCommand extends Command {
  constructor() {
    super("help", "Show every command, grouped by feature");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, user }: ExecuteContext) {
    const guild = ctx.guild!;
    const config = await helpPanel.getConfig(guild);
    const segment = config.categories[0]?.id ?? "bot";
    return ctx.reply(await renderPanel(helpPanel, { guild, user }, segment));
  }
}
