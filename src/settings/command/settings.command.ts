import SettingsManager from "..";
import Command, { type ExecuteContext } from "../../command/command";
import GuildFeatures from "../../feature/guild-features";
import { ephemeralErrorReply, errorEmbed } from "../../lib/embed";
import { PermissionFlags } from "../../permission/permissions";
import { moduleControls, moduleEmbed, modulesSelectRow, overviewEmbed } from "../panel";

/**
 * Open the interactive settings panel: an overview of every registered
 * settings module (for enabled features), with a select to navigate into a
 * module page where each setting has an edit dialog.
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

    const modules = SettingsManager.all();
    if (modules.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No settings modules registered.")
        )
      );
    }

    const enabledModuleIds: string[] = [];
    for (const module of modules) {
      const enabled =
        module.featureId === null || (await GuildFeatures.isFeatureEnabled(guild, module.featureId));
      if (enabled) {
        enabledModuleIds.push(module.id);
      }
    }
    if (enabledModuleIds.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No settings modules available for enabled features.")
        )
      );
    }

    // A single module opens straight to its page.
    if (enabledModuleIds.length === 1) {
      const module = SettingsManager.get(enabledModuleIds[0]!);
      if (module) {
        const embed = await moduleEmbed(commandName, module, guild);
        const controls = await moduleControls(module, guild);
        return ctx.reply({ embeds: [embed], components: controls });
      }
    }

    const embed = overviewEmbed(commandName);
    return ctx.reply({ embeds: [embed], components: [modulesSelectRow(enabledModuleIds)] });
  }
}
