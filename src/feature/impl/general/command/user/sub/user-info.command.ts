import Command, { type ExecuteContext } from "@/command/command";
import { userOption } from "@/command/option";
import { FeatureIds } from "@/feature/feature-ids";
import GuildFeatures from "@/feature/guild-features";
import { birthdayService } from "@/feature/impl/birthday/birthday.service";
import { marriageService } from "@/feature/impl/marriage/marriage.service";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { daysUntil, monthName } from "@/lib/date";
import { discordTimestamp } from "@/lib/time";
import { baseEmbed } from "@/lib/embed";
import { formatCount } from "@/lib/format";
import { fetchGuildMember } from "@/lib/guild";
import type GlobalUser from "@/user/global-user";
import GlobalUsersManager from "@/user/global-users-manager";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type MessageActionRowComponentBuilder,
  type User,
} from "discord.js";

export default class UserInfoCommand extends Command {
  constructor() {
    super({ id: "info", displayName: "Show a user's info" });
  }

  public override get options() {
    return [userOption(false, "user", "Whose info to show")];
  }

  protected override async onExecuteSlash({ user, guild, ctx, args, commandName }: ExecuteContext) {
    const rawTarget = args.user("user") ?? user.discordUser;
    const targetGlobal = rawTarget.id === user.id ? user : await GlobalUsersManager.getUser(rawTarget);
    const target = await rawTarget.fetch();
    return this.replyInfo(commandName, target, targetGlobal, guild, ctx);
  }

  private async replyInfo(
    commandName: string,
    target: User,
    targetGlobal: GlobalUser,
    guild: Guild | null,
    ctx: ChatInputCommandInteraction
  ): Promise<unknown> {
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "webp" });
    const bannerUrl = target.bannerURL({ size: 4096, extension: "webp" });

    let member: GuildMember | null = null;
    if (guild) {
      member = await fetchGuildMember(guild, target.id);
    }

    const lines: string[] = [];
    if (member) {
      const roles = member.roles.cache
        .filter(role => role.id !== guild!.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString());
      lines.push("**🎭 Server**");
      lines.push(`**Roles:** ${roles.length ? roles.join(" ") : "None"}`);
      if (member.joinedAt) {
        lines.push(`**Joined Server:** ${discordTimestamp(member.joinedAt)}`);
      }
      if (member.premiumSince) {
        lines.push(`**Boosting Since:** ${discordTimestamp(member.premiumSince)}`);
      }

      if (guild) {
        const [levelsEnabled, birthdayEnabled, marriageEnabled] = await Promise.all([
          GuildFeatures.isFeatureEnabled(guild, FeatureIds.Levels),
          GuildFeatures.isFeatureEnabled(guild, FeatureIds.Birthday),
          GuildFeatures.isFeatureEnabled(guild, FeatureIds.Marriage),
        ]);
        if (levelsEnabled) {
          const rank = await levelsService.getRankState(guild.id, target.id);
          const barLength = 10;
          const filled = Math.round(rank.progress * barLength);
          const bar = `\`${"█".repeat(filled)}${"░".repeat(barLength - filled)}\``;
          lines.push("");
          lines.push("**📊 Levels**");
          lines.push(`**Level:** ${rank.level} (${formatCount(rank.xp)} XP)`);
          lines.push(`${bar} **${filled * (100 / barLength)}%** to level ${rank.level + 1}`);
          lines.push(
            `**Server Rank:** ${rank.guildRank === null ? "Not ranked yet" : `#${rank.guildRank} of ${rank.totalTracked}`}`
          );
        }
        if (marriageEnabled) {
          const marriage = await marriageService.getMarriage(guild.id, target.id);
          if (marriage) {
            lines.push("");
            lines.push("**💍 Marriage**");
            lines.push(`**Married To:** <@${marriage.partnerId}>`);
            lines.push(`**Since:** ${discordTimestamp(marriage.marriedAt)}`);
          }
        }
        if (birthdayEnabled) {
          const birthday = await birthdayService.getBirthday(guild.id, target.id);
          if (birthday) {
            const days = daysUntil(birthday.month, birthday.day);
            lines.push("");
            lines.push("**🎂 Birthday**");
            lines.push(`**Date:** ${monthName(birthday.month)} ${birthday.day}`);
            lines.push(
              days === 0 ? "**Happy Birthday!** 🎉" : `**Next:** in ${days} day${days === 1 ? "" : "s"}`
            );
          }
        }
      }
    }
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("**🗓️ Account**");
    lines.push(`**Account Created:** ${discordTimestamp(target.createdAt)}`);
    lines.push(`**First Seen:** ${discordTimestamp(targetGlobal.firstSeen)}`);
    lines.push(`**User ID:** \`${target.id}\``);

    const embed = baseEmbed(commandName)
      .setTitle(`👤 ${target.displayName}'s Info`)
      .setThumbnail(avatarUrl)
      .setDescription(lines.join("\n"));

    const buttons = [new ButtonBuilder().setLabel("Avatar").setStyle(ButtonStyle.Link).setURL(avatarUrl)];
    if (bannerUrl) {
      buttons.push(new ButtonBuilder().setLabel("Banner").setStyle(ButtonStyle.Link).setURL(bannerUrl));
    }
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons);

    return ctx.reply({ embeds: [embed], components: [row] });
  }
}
