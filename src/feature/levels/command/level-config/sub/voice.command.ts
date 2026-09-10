import Command, { type ExecuteContext } from "../../../../../command/command";
import { integerOption, type CommandOptionBuilder } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { PermissionFlags } from "../../../../../permission/permissions";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./view.command";

/**
 * Set the XP rate per whole minute of voice time. Voice XP is awarded at
 * session end, so minutes are always whole.
 */
export default class VoiceCommand extends Command {
  constructor() {
    super("voice", "Set voice XP per minute");
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_CONFIG_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [integerOption(true, "xp", "XP earned per whole minute in voice chat")];
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const voiceXp = ctx.options.getInteger("xp", true)!;
    if (voiceXp < 1) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Voice XP must be at least 1.")
        )
      );
    }
    const config = await levelsService.setConfig(guild.id, { voiceXpPerMin: voiceXp });
    const embed = baseEmbed(commandName)
      .setTitle("🎙️ Voice XP Updated")
      .setDescription(
        `**Voice XP** is now **${config.voiceXpPerMin}**/min.\n${configSummaryLines(config).join("\n")}`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
