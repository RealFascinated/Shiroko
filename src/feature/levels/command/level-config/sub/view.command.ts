import Command, { type ExecuteContext } from "../../../../../command/command";
import { baseEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./config-helpers";

/**
 * Show the guild's current levelling configuration as a result card.
 */
export default class ViewCommand extends Command {
  constructor() {
    super("view", "Show the current levelling config");
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const config = await levelsService.getConfig(guild.id);
    const embed = baseEmbed(commandName)
      .setTitle("⚙️ Levelling Config")
      .setDescription(configSummaryLines(config).join("\n"));
    return ctx.reply({ embeds: [embed] });
  }
}
