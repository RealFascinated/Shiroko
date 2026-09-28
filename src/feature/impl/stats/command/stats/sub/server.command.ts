import Command, { type ExecuteContext } from "@/command/command";
import { renderStatsCard } from "@/feature/impl/stats/stats-card";
import { statsService } from "@/feature/impl/stats/stats.service";
import { ephemeralErrorReply, errorEmbed } from "@/lib/embed";

/**
 * Show the whole server's combined activity as a card.
 */
export default class StatsServerCommand extends Command {
  constructor() {
    super("server", "Show the whole server's activity as a card");
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    const guildId = guild?.id ?? ctx.guildId;
    if (!guildId) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Stats are only available in servers.")
        )
      );
    }
    const stats = await statsService.getGuildCardData(guildId, "overall");
    const png = await renderStatsCard({
      kind: "overall",
      scope: "server",
      name: guild?.name ?? "This server",
      avatarUrl: guild?.iconURL({ size: 256, extension: "png" }) ?? null,
      guildName: guild?.name ?? "This server",
      ...stats,
    });
    return ctx.reply({ files: [{ attachment: png, name: `stats-server-${guildId}.png` }] });
  }
}
