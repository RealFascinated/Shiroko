import Command, { type ExecuteContext } from "../../../../../command/command";
import { userOption } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";

/**
 * Show a user's rank: level, XP, progress to the next level, and their
 * guild rank.
 */
export default class RankCommand extends Command {
  constructor() {
    super("rank", "Show your (or another user's) level and XP");
  }

  public override get options() {
    return [userOption(false, "user", "Whose rank to show (defaults to you)")];
  }

  protected override async onExecuteSlash({ user, guild, ctx, args, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const guildId = guild.id;
    const target = args.user("user") ?? user.discordUser;
    if (target.bot) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("Bots don't level up."))
      );
    }
    const rank = await levelsService.getRankState(guildId, target.id);
    const barLength = 10;
    const filled = Math.round(rank.progress * barLength);
    const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
    const rankLine =
      rank.guildRank === null
        ? "Not ranked yet; send a message to start earning XP!"
        : `**#${rank.guildRank}** in the server`;
    const embed = baseEmbed(commandName)
      .setTitle("📊 Level Rank")
      .setDescription(
        `**${target}** is **level ${rank.level}** (${rank.xp} XP).\n` +
          `${bar} ${Math.round(rank.progress * 100)}% to level ${rank.level + 1}\n` +
          `${rank.nextLevelXp - rank.xp} XP to go: ${rankLine}`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
