import Command, { type ExecuteContext } from "@/command/command";
import { logTypes } from "@/feature/impl/logging/log-type";
import { loggingService } from "@/feature/impl/logging/logging.service";
import { baseEmbed } from "@/lib/embed";

/**
 * Show the guild's logging configuration: the target channel and every log
 * type's state.
 */
export default class InfoCommand extends Command {
  constructor() {
    super({ id: "info", displayName: "Show the server's logging configuration" });
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const { channelId, states } = await loggingService.info(guild);
    const channel = channelId ? `<#${channelId}>` : "*(not set)*";
    const lines = states.map(
      ({ logType, enabled }) => `${enabled ? "✅" : "❌"} **${logTypes[logType].label}**`
    );
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("📔 Logging")
          .setDescription(`**Channel:** ${channel}\n\n${lines.join("\n")}`),
      ],
    });
  }
}
