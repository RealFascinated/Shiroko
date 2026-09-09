import { type ChatInputCommandInteraction, type User } from "discord.js";
import { ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { renderStatsCard, type StatsCardKind } from "../../../stats-card";
import { statsService } from "../../../stats.service";

/**
 * Fetch `target`'s card data, render the PNG, and reply with it. Stats are
 * guild-scoped, so a missing guild is an error.
 */
export async function replyStatsCard(
  ctx: ChatInputCommandInteraction,
  commandName: string,
  target: User,
  guildId: string | null,
  guildName: string | undefined,
  kind: StatsCardKind
): Promise<ReturnType<ChatInputCommandInteraction["reply"]>> {
  if (!guildId) {
    return ctx.reply(
      ephemeralErrorReply(
        commandName,
        errorEmbed(commandName).setDescription("Stats are only available in servers.")
      )
    );
  }
  const stats = await statsService.getCardData(target.id, guildId, kind);
  const png = await renderStatsCard({
    kind,
    scope: "user",
    name: target.displayName,
    avatarUrl: target.displayAvatarURL({ size: 256, extension: "png" }),
    guildName: guildName ?? "This server",
    ...stats,
  });
  return ctx.reply({ files: [{ attachment: png, name: `stats-${kind}-${target.id}.png` }] });
}
