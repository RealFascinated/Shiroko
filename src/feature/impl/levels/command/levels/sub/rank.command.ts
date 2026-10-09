import Command, { type ExecuteContext } from "@/command/command";
import { userOption } from "@/command/option";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { renderRankCard } from "@/feature/impl/levels/rank-card";
import { ephemeralErrorReply, errorEmbed } from "@/lib/embed";

export default class RankCommand extends Command {
  constructor() {
    super({ id: "rank", displayName: "Show your (or another user's) level and XP" });
  }

  public override get options() {
    return [userOption(false, "user", "Whose rank to show (defaults to you)")];
  }

  protected override async onExecuteSlash({ user, ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const target = args.user("user") ?? user.discordUser;
    if (target.bot) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("Bots don't level up."))
      );
    }
    const rank = await levelsService.getRankState(guild.id, target.id);
    const nextReward = await levelsService.nextReward(guild.id, rank.level);
    const png = await renderRankCard({
      name: target.displayName,
      avatarUrl: target.displayAvatarURL({ size: 256, extension: "png" }),
      level: rank.level,
      xp: rank.xp,
      nextLevelXp: rank.nextLevelXp,
      progress: rank.progress,
      guildRank: rank.guildRank,
      totalTracked: rank.totalTracked,
      reward: nextReward
        ? {
            level: nextReward.level,
            roleName: nextReward.roleId ? (guild.roles.cache.get(nextReward.roleId)?.name ?? null) : null,
          }
        : null,
    });
    return ctx.reply({ files: [{ attachment: png, name: `rank-${target.id}.png` }] });
  }
}
