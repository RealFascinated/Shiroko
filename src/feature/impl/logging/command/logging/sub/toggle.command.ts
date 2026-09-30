import Command, { type ExecuteContext } from "@/command/command";
import { booleanOption, stringOption, type CommandOptionBuilder } from "@/command/option";
import { logTypes, type LogType } from "@/feature/impl/logging/log-type";
import { loggingService } from "@/feature/impl/logging/logging.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";

const LOG_TYPE_CHOICES: Record<string, string> = Object.fromEntries(
  Object.entries(logTypes).map(([logType, meta]) => [logType, meta.label])
);

export default class ToggleCommand extends Command {
  constructor() {
    super("toggle", "Enable or disable a log type");
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      stringOption(true, "type", "Which log type to toggle", { choices: LOG_TYPE_CHOICES }),
      booleanOption(true, "enabled", "Turn the log type on or off"),
    ];
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const logType = args.string("type") as LogType | null;
    if (!logType || !(logType in logTypes)) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("A log type is required."))
      );
    }
    const enabled = ctx.options.getBoolean("enabled", true)!;
    await loggingService.setEnabled(guild, logType, enabled);
    const label = logTypes[logType].label;
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("📔 Log Type Toggled")
          .setDescription(`**${label}** logging is now **${enabled ? "enabled" : "disabled"}**.`),
      ],
    });
  }
}
