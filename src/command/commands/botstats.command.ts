import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { globalUsers } from "../../db/schema";
import { baseEmbed } from "../../lib/embed";
import { formatDuration } from "../../lib/time";
import Command, { type ExecuteContext } from "../command";

/**
 * Show the bot's own stats: servers it is in, users it has seen, latency, RAM and uptime.
 */
export default class BotStatsCommand extends Command {
  constructor() {
    super("botstats", "Show the bot's stats: servers, users, status");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const bot = await ctx.client.user!.fetch();
    const avatarUrl = bot.displayAvatarURL({ size: 4096, extension: "webp" });
    const bannerUrl = bot.bannerURL({ size: 4096, extension: "webp" });
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${ctx.client.application!.id}&scope=bot%20applications.commands&permissions=8`;
    const [userCount] = await db.select({ value: sql<number>`count(*)` }).from(globalUsers);

    const sections: string[][] = [
      [
        `**🌐 Presence**`,
        `**Servers:** ${ctx.client.guilds.cache.size.toLocaleString("en-US")}`,
        `**Users Seen:** ${(userCount?.value ?? 0).toLocaleString("en-US")}`,
      ],
      [
        `**⚡ Status**`,
        `**Latency:** ${ctx.client.ws.ping}ms`,
        `**RAM:** ${(process.memoryUsage().rss / 1024 ** 2).toFixed(1)} MB`,
        `**Uptime:** ${formatDuration(process.uptime() * 1000)}`,
      ],
    ];

    const lines = sections.map(section => section.join("\n")).join("\n\n");

    const embed = baseEmbed(commandName)
      .setTitle(`🤖 ${bot.displayName}'s Stats`)
      .setThumbnail(avatarUrl)
      .setDescription(lines);

    if (bannerUrl) {
      embed.setImage(bannerUrl);
    }

    const buttons = [new ButtonBuilder().setLabel("Invite").setStyle(ButtonStyle.Link).setURL(inviteUrl)];
    if (bannerUrl) {
      buttons.push(new ButtonBuilder().setLabel("Banner").setStyle(ButtonStyle.Link).setURL(bannerUrl));
    }
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons);

    return ctx.reply({ embeds: [embed], components: [row] });
  }
}
