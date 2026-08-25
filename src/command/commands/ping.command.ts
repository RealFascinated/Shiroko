import { baseEmbed } from "../../lib/embed";
import Command, { type ExecuteContext } from "../command";

export default class PingCommand extends Command {
  constructor() {
    super("ping", "Check bot latency");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🏓 Pong!")
          .addFields(
            {
              name: "API Latency",
              value: `\`${Date.now() - ctx.createdTimestamp}ms\``,
              inline: true,
            },
            {
              name: "Gateway Latency",
              value: `\`${ctx.client.ws.ping}ms\``,
              inline: true,
            }
          ),
      ],
    });
  }
}
