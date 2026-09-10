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
import Command, { type ExecuteContext } from "../../../../command/command";
import { userOption } from "../../../../command/option";
import { baseEmbed } from "../../../../lib/embed";
import { fetchGuildMember } from "../../../../lib/guild";
import type GlobalUser from "../../../../user/global-user";
import GlobalUsersManager from "../../../../user/global-users-manager";

/**
 * Show a user's info: first seen, ids, avatar, banner, and server roles
 * when run in a guild.
 */
export default class UserInfoCommand extends Command {
  constructor() {
    super("info", "Show a user's info");
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
  ): Promise<ReturnType<Command["executeSlash"]>> {
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "webp" });
    const bannerUrl = target.bannerURL({ size: 4096, extension: "webp" });

    let member: GuildMember | null = null;
    if (guild) {
      member = await fetchGuildMember(guild, target.id);
    }

    const sections: string[][] = [];
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
      .setTitle(`👤 ${target.displayName}'s Info`)
      .setThumbnail(avatarUrl)
      .setDescription(lines);

    const buttons = [new ButtonBuilder().setLabel("Avatar").setStyle(ButtonStyle.Link).setURL(avatarUrl)];
    if (bannerUrl) {
      buttons.push(new ButtonBuilder().setLabel("Banner").setStyle(ButtonStyle.Link).setURL(bannerUrl));
    }
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons);

    return ctx.reply({ embeds: [embed], components: [row] });
  }
}
