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
import { runesService, type Balance } from "../../feature/economy/runes.service";
import { fetchGuildMember } from "../../lib/discord";
import { baseEmbed, runes } from "../../lib/embed";
import { formatRank } from "../../lib/format";
import type GlobalUser from "../../user/global-user";
import GlobalUsersManager from "../../user/global-users-manager";
import Command, { type ExecuteContext } from "../command";
import { userOption } from "../option";

/**
 * Show a user's profile: rune balance, first seen, ids, avatar, banner, and
 * server roles when run in a guild.
 */
export default class UserCommand extends Command {
  constructor() {
    super("user", "Show a user's profile: balance, avatar, banner and more");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [userOption(false, "user", "Whose profile to show")];
  }

  protected override async onExecuteSlash({ globalUser, guild, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("user") ?? globalUser.discordUser;
    if (target === globalUser.discordUser) {
      const [balance, rank] = await Promise.all([
        runesService.getBalance(globalUser.id),
        runesService.getGlobalRank(globalUser.id),
      ]);
      return this.replyProfile(commandName, target, globalUser, balance, rank, guild, ctx);
    }

    const targetGlobal = await GlobalUsersManager.getUser(target);
    const [balance, rank] = await Promise.all([
      runesService.getBalance(targetGlobal.id),
      runesService.getGlobalRank(targetGlobal.id),
    ]);
    return this.replyProfile(commandName, target, targetGlobal, balance, rank, guild, ctx);
  }

  private async replyProfile(
    commandName: string,
    target: User,
    targetGlobal: GlobalUser,
    balance: Balance,
    rank: number | null,
    guild: Guild | null,
    ctx: ChatInputCommandInteraction
  ): Promise<ReturnType<Command["executeSlash"]>> {
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "webp" });
    const bannerUrl = target.bannerURL({ size: 4096, extension: "webp" });

    let member: GuildMember | null = null;
    if (guild) {
      member = await fetchGuildMember(guild, target.id);
    }

    const sections: string[][] = [
      [
        `**💰 Economy**`,
        `**Wallet:** ${runes(balance.wallet)}`,
        `**Bank:** ${runes(balance.bank)}`,
        `**Global Rank:** ${formatRank(rank)}`,
      ],
    ];
    if (member) {
      const roles = member.roles.cache
        .filter(role => role.id !== guild!.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString());
      sections.push([
        `**🎭 Server**`,
        `**Roles:** ${roles.length ? roles.join(" ") : "None"}`,
        ...(member.premiumSince
          ? [`**Boosting Since:** <t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>`]
          : []),
      ]);
    }
    sections.push([
      `**🗓️ Account**`,
      `**Account Created:** <t:${Math.floor(target.createdAt.getTime() / 1000)}:R>`,
      `**First Seen:** <t:${Math.floor(targetGlobal.firstSeen.getTime() / 1000)}:R>`,
      `**User ID:** \`${target.id}\``,
    ]);

    const lines = sections.map(section => section.join("\n")).join("\n\n");

    const embed = baseEmbed(commandName)
      .setTitle(`👤 ${target.displayName}'s Profile`)
      .setThumbnail(avatarUrl)
      .setDescription(lines);

    if (bannerUrl) {
      embed.setImage(bannerUrl);
    }

    const buttons = [new ButtonBuilder().setLabel("Avatar").setStyle(ButtonStyle.Link).setURL(avatarUrl)];
    if (bannerUrl) {
      buttons.push(new ButtonBuilder().setLabel("Banner").setStyle(ButtonStyle.Link).setURL(bannerUrl));
    }
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons);

    return ctx.reply({ embeds: [embed], components: [row] });
  }
}
