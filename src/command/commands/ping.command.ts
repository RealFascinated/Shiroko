import { EmbedBuilder } from "discord.js";
import Command from "../command";
import type { ExecuteContext } from "../command";
import { Constants } from "../../constants";

export default class PingCommand extends Command {
  constructor() {
    super("ping", "Check bot latency");
  }

  protected override async onExecuteSlash({ ctx }: ExecuteContext) {
    return ctx.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏓 Pong!")
          .setColor(Constants.mainColor)
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
