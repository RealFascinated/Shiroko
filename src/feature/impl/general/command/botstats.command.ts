import { cachedUserCount, formatClusterId, formatShardId, guildCount } from "@/cluster/cluster";
import Command, { type ExecuteContext } from "@/command/command";
import { Constants } from "@/constants";
import { db } from "@/db/index";
import { globalUsersSchema } from "@/db/schemas/global-users";
import { baseEmbed } from "@/lib/embed";
import { formatCount } from "@/lib/format";
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
    const [guilds, users] = await Promise.all([guildCount(ctx.client), cachedUserCount(ctx.client)]);
    const cluster = ctx.client.cluster;

    const sections: string[][] = [
      [
        `**🌐 Bot**`,
        `**Servers:** ${guilds === null ? "-" : formatCount(guilds)}`,
        `**Users:** ${users === null ? "-" : formatCount(users)}`,
        `**Users Seen:** ${formatCount(userCount?.value ?? 0)}`,
        `**Commands:** ${formatCount(ctx.client.application.commands.cache.size)}`,
        `**Commands Run:** ${formatCount(commandCalls)}`,
      ],
      [
        `**⚡ Status**`,
        `**Cluster:** ${formatClusterId(cluster.id)} of ${cluster.count}`,
        `**Shard:** ${formatShardId(ctx.guild?.shardId ?? 0)} of ${cluster.info.TOTAL_SHARDS}`,
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
