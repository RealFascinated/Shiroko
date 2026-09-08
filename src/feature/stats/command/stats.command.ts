import type { ChatInputCommandInteraction, User } from "discord.js";
import Command, { type ExecuteContext } from "../../../command/command";
import { userOption } from "../../../command/option";
import { ephemeralErrorReply, errorEmbed } from "../../../lib/embed";
import { renderStatsCard, type StatsCardKind } from "../stats-card";
import { statsService } from "../stats.service";

/**
 * Show user activity stats as a card: message counts, voice hours, or both.
 * Guild-only; tracking is per-guild.
 */
export default class StatsCommand extends Command {
  constructor() {
    super("stats", "Show activity stats as a card");
    this.registerSubCommand(new StatsKindCommand("messages", "messages", "Show message stats as a card"));
    this.registerSubCommand(new StatsKindCommand("voice", "voice", "Show voice stats as a card"));
    this.registerSubCommand(
      new StatsKindCommand("overall", "overall", "Show combined activity stats as a card")
    );
    this.registerSubCommand(new StatsServerCommand());
  }

  protected override async onExecuteSlash({ ctx }: ExecuteContext) {
    return ctx.reply({
      content: "Choose a subcommand: /stats messages, /stats voice, /stats overall or /stats server",
    });
  }
}

/**
 * Show the whole server's combined activity as a card.
 */
class StatsServerCommand extends Command {
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

/**
 * One `/stats` subcommand: the kind selects the card and its chart, the
 * rest is shared.
 */
class StatsKindCommand extends Command {
  public constructor(
    private readonly kind: StatsCardKind,
    id: string,
    description: string
  ) {
    super(id, description);
  }

  public override get options() {
    return [userOption(false, "user", "Whose stats to show (defaults to you)")];
  }

  protected override async onExecuteSlash({ globalUser, guild, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("user") ?? globalUser.discordUser;
    return replyStatsCard(ctx, commandName, target, guild?.id ?? ctx.guildId, guild?.name, this.kind);
  }
}

/**
 * Fetch `target`'s card data, render the PNG, and reply with it. Stats are
 * guild-scoped, so a missing guild is an error.
 */
async function replyStatsCard(
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
