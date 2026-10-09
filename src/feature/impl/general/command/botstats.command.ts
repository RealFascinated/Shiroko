import Command, { type ExecuteContext } from "@/command/command";
import { Constants } from "@/constants";
import { db } from "@/db/index";
import { globalUsersSchema } from "@/db/schemas/global-users";
import { baseEmbed } from "@/lib/embed";
import { formatDuration } from "@/lib/time";
import CommandCallService from "@/metrics/command-calls.service";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { sql } from "drizzle-orm";
import { getHeapStatistics } from "node:v8";

export default class BotStatsCommand extends Command {
  constructor() {
    super({ id: "botstats", displayName: "Show the bot's stats: servers, users, status" });
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const bot = await ctx.client.user!.fetch();
    const avatarUrl = bot.displayAvatarURL({ size: 4096, extension: "webp" });
    const [userCount] = await db.select({ value: sql<number>`count(*)` }).from(globalUsersSchema);
    const commandCalls = await CommandCallService.total();
    const { heap_size_limit: heapMax } = getHeapStatistics();

    const sections: string[][] = [
      [
        `**🌐 Bot**`,
        `**Servers:** ${ctx.client.guilds.cache.size.toLocaleString("en-US")}`,
        `**Users:** ${ctx.client.users.cache.size.toLocaleString("en-US")}`,
        `**Users Seen:** ${(userCount?.value ?? 0).toLocaleString("en-US")}`,
        `**Commands:** ${ctx.client.application.commands.cache.size.toLocaleString("en-US")}`,
        `**Commands Run:** ${commandCalls.toLocaleString("en-US")}`,
      ],
      [
        `**⚡ Status**`,
        `**Latency:** ${ctx.client.ws.ping}ms`,
        `**RAM:** ${Math.round(process.memoryUsage().rss / 1024 ** 2)}/${Math.round(heapMax / 1024 ** 2)} MB`,
        `**Uptime:** ${formatDuration(process.uptime() * 1000)}`,
      ],
    ];

    const lines = sections.map(section => section.join("\n")).join("\n\n");

    const embed = baseEmbed(commandName)
      .setTitle(`🤖 ${bot.displayName}'s Stats`)
      .setThumbnail(avatarUrl)
      .setDescription(lines);

    const buttons = [
      new ButtonBuilder().setLabel("Invite").setStyle(ButtonStyle.Link).setURL(Constants.inviteUrl),
    ];
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons);

    return ctx.reply({ embeds: [embed], components: [row] });
  }
}
