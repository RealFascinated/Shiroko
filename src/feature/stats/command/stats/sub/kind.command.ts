import Command, { type ExecuteContext } from "../../../../../command/command";
import { userOption } from "../../../../../command/option";
import { ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import type { StatsCardKind } from "../../../stats-card";
import { replyStatsCard } from "./reply-stats-card";

/**
 * One `/stats` subcommand: the kind selects the card and its chart, the
 * rest is shared.
 */
export default class StatsKindCommand extends Command {
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
    if (target.bot) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("Bots don't have stats."))
      );
    }
    return replyStatsCard(ctx, commandName, target, guild?.id ?? ctx.guildId, guild?.name, this.kind);
  }
}
