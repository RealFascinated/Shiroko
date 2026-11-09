import Command, { type ExecuteContext } from "@/command/command";
import { baseEmbed } from "@/lib/embed";
import { formatCount } from "@/lib/format";
import { discordTimestamp } from "@/lib/time";
import { ChannelType } from "discord.js";

export default class GuildInfoCommand extends Command {
  constructor() {
    super({ id: "guildinfo", displayName: "Show the current server's info" });
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;

    const iconUrl = guild.iconURL({ size: 4096, extension: "webp" });
    const textChannels = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(
      channel => channel.type === ChannelType.GuildVoice
    ).size;

    const statusCounts = guild.members.cache.reduce(
      (counts, member) => {
        const status = member.presence?.status ?? "offline";
        counts[status === "invisible" ? "offline" : status]++;
        return counts;
      },
      { online: 0, idle: 0, dnd: 0, offline: 0 }
    );

    const sections: string[][] = [
      [
        "**📊 Server**",
        `**Channels:** ${guild.channels.cache.size} (${textChannels} text · ${voiceChannels} voice)`,
        `**Roles:** ${guild.roles.cache.size}`,
        `**Boosts:** ${guild.premiumSubscriptionCount} (Level ${guild.premiumTier})`,
      ],
      [
        "**👥 Members**",
        `**Total:** ${formatCount(guild.memberCount)}`,
        `**Online:** ${formatCount(statusCounts.online)}`,
        `**Idle:** ${formatCount(statusCounts.idle)}`,
        `**DND:** ${formatCount(statusCounts.dnd)}`,
        `**Offline:** ${formatCount(statusCounts.offline)}`,
      ],
      [
        "**🕰️ History**",
        `**Created:** ${discordTimestamp(new Date(guild.createdTimestamp))}`,
        `**Bot Joined:** ${discordTimestamp(new Date(guild.joinedTimestamp))}`,
        `**Owner:** <@${guild.ownerId}>`,
      ],
    ];

    const lines = sections.map(section => section.join("\n")).join("\n\n");

    const embed = baseEmbed(commandName).setTitle(`🏛️ ${guild.name}`).setDescription(lines);
    if (iconUrl) {
      embed.setThumbnail(iconUrl);
    }

    return ctx.reply({ embeds: [embed] });
  }
}
