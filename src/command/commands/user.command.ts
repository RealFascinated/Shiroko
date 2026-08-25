import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { runesService } from "../../feature/economy/runes.service";
import { baseEmbed, runes } from "../../lib/embed";
import { formatRank } from "../../lib/format";
import GlobalUsersManager from "../../user/global-users-manager";
import Command, { type ExecuteContext } from "../command";
import { userOption } from "../option";

/**
 * Show a user's profile: rune balance, first seen, ids, avatar, banner, and
 * server roles when run in a guild.
 */
export default class UserCommand extends Command {
  constructor() {
    super("user", "Show user info");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [userOption(false, "user", "Whose profile to show")];
  }

  protected override async onExecuteSlash({ globalUser, guild, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("user") ?? globalUser.discordUser;
    const [targetGlobal, balance, rank] = await Promise.all([
      GlobalUsersManager.getUser(target),
      runesService.getBalance(target.id),
      runesService.getGlobalRank(target.id),
    ]);

    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "webp" });
    const bannerUrl = target.bannerURL({ size: 4096, extension: "webp" });

    let member: GuildMember | null = null;
    if (guild) {
      member = guild.members.cache.get(target.id) ?? null;
      if (!member) {
        try {
          member = await guild.members.fetch(target.id);
        } catch {
          member = null;
        }
      }
    }

    const lines = [
      `**Wallet:** ${runes(balance.wallet)}`,
      `**Bank:** ${runes(balance.bank)}`,
      `**Global Rank:** ${formatRank(rank)}`,
      `**Account Created:** <t:${Math.floor(target.createdAt.getTime() / 1000)}:R>`,
      `**First Seen:** <t:${Math.floor(targetGlobal.firstSeen.getTime() / 1000)}:R>`,
      `**User ID:** \`${target.id}\``,
    ];
    if (member) {
      const roles = member.roles.cache
        .filter(role => role.id !== guild!.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString());
      lines.push(`**Roles:** ${roles.length ? roles.join(" ") : "None"}`);
      if (member.premiumSince) {
        lines.push(`**Boosting Since:** <t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>`);
      }
    }

    const embed = baseEmbed(commandName)
      .setTitle(`👤 ${target.displayName}'s Profile`)
      .setThumbnail(avatarUrl)
      .setDescription(lines.join("\n"));

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
