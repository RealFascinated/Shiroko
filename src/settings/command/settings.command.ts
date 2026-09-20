import SettingsManager from "..";
import Command, { type ExecuteContext } from "../../command/command";
import { ephemeralErrorReply, errorEmbed } from "../../lib/embed";
import { PermissionFlags } from "../../permission/permissions";
import { renderPanel } from "../panel";

/**
 * Open the interactive settings panel: a help section for the selected
 * category, a category dropdown, and the action rows to edit that
 * category's settings. Choosing a category from the dropdown swaps the
 * action rows below.
 */
export default class SettingsCommand extends Command {
  constructor() {
    super("settings", "Configure server settings");
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.SETTINGS_COMMAND;
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Settings can only be changed in servers.")
        )
      );
    }

    const modules = await SettingsManager.enabledModules(guild);
    if (modules.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No settings modules available for enabled features.")
        )
      );
    }

    const panel = await renderPanel(
      commandName,
      guild,
      modules.map(m => m.id),
      modules[0]!
    );
    return ctx.reply(panel);
  }
}
