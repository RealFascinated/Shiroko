import Command, { type ExecuteContext } from "../../../../../command/command";
import { userOption } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";

/**
 * Podium colors for the top three ranks on the server.
 */
const PODIUM_COLORS = {
  1: 0xffd700,
  2: 0xc0c0c0,
  3: 0xcd7f32,
};

/**
 * Show a user's rank card: level, XP, progress as a bar with the matching
 * percentage, their position among everyone the server tracks, and the
 * next reward role when one is configured.
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
    const nextReward = await levelsService.nextReward(guildId, rank.level);

    // Bar and percentage come from the same filled-cell count, so they can
    // never disagree with each other.
    const barLength = 10;
    const filled = Math.round(rank.progress * barLength);
    const percent = filled * (100 / barLength);
    const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

    const rankLine =
      rank.guildRank === null
        ? "Not ranked yet; send a message to start earning XP!"
        : `Rank **#${rank.guildRank}** of **${rank.totalTracked}** in the server`;

    const details = [
      `**${target}** is **level ${rank.level}** (${rank.xp.toLocaleString("en-US")} XP)`,
      `${bar} **${percent}%** to level ${rank.level + 1}`,
      `**${rank.nextLevelXp.toLocaleString("en-US")}** XP total needed for level ${rank.level + 1} (${(rank.nextLevelXp - rank.xp).toLocaleString("en-US")} to go)`,
      rankLine,
    ];
    if (nextReward) {
      details.splice(
        1,
        0,
        `Next reward at level **${nextReward.level}**: ${nextReward.roleId ? `<@&${nextReward.roleId}>` : "something special"}`
      );
    }

    // Top three get a podium tint; the footer and theme still come from
    // baseEmbed, so only the color changes.
    const podiumColor = rank.guildRank !== null ? PODIUM_COLORS[rank.guildRank as 1 | 2 | 3] : null;
    const embed = baseEmbed(commandName)
      .setColor(podiumColor)
      .setTitle("📊 Level Rank")
      .setThumbnail(target.displayAvatarURL())
      .setDescription(
        details.join("\n") + `\n\n*Keep chatting and hanging out in voice to climb the ranks.*`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
