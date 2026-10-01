import Command, { type ExecuteContext } from "@/command/command";
import { ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { renderPanel } from "@/panel/render";
import { PermissionFlags } from "@/permission/permissions";
import SettingsManager from "../index";
import { settingsPanel } from "../settings-panel";

/**
 * Open the aggregated settings panel: the engine renders every enabled
 * settings module as a view, the view switcher acting as the category
 * dropdown and each view's controls editing that module's settings.
 */
export default class SettingsCommand extends Command {
  constructor() {
    super("settings", "Configure server settings");
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.SETTINGS_COMMAND;
  }

  protected override async onExecuteSlash({ ctx, user, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const modules = await SettingsManager.enabledModules(guild);
    if (modules.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No settings modules available for enabled features.")
        )
      );
    }

    const context = { guild, user };
    const segment = modules[0]!.id;
    const reply = await ctx.reply(await renderPanel(settingsPanel, context, segment));
    return reply;
  }
}
