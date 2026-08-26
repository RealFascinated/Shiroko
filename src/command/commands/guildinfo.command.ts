import { ChannelType, GuildVerificationLevel } from "discord.js";
import { baseEmbed } from "../../lib/embed";
import Command, { type ExecuteContext } from "../command";

/** Human labels for Discord's verification levels. */
const VERIFICATION_LABELS: Record<GuildVerificationLevel, string> = {
  [GuildVerificationLevel.None]: "None",
  [GuildVerificationLevel.Low]: "Low",
  [GuildVerificationLevel.Medium]: "Medium",
  [GuildVerificationLevel.High]: "High",
  [GuildVerificationLevel.VeryHigh]: "Very High",
};

/**
 * Show the current server's info: member and channel counts, roles, boosts,
 * safety settings, and history. Guild-only.
 */
export default class GuildInfoCommand extends Command {
  constructor() {
    super("guildinfo", "Show the current server's info");
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;

    const iconUrl = guild.iconURL({ size: 4096, extension: "webp" });
    const textChannels = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(
      channel => channel.type === ChannelType.GuildVoice
    ).size;

    const sections: string[][] = [
      [
        "**📊 Server**",
        `**Members:** ${guild.memberCount.toLocaleString("en-US")}`,
        `**Channels:** ${guild.channels.cache.size} (${textChannels} text · ${voiceChannels} voice)`,
        `**Roles:** ${guild.roles.cache.size}`,
        `**Boosts:** ${guild.premiumSubscriptionCount} (Level ${guild.premiumTier})`,
      ],
      [
        "**🛡️ Safety**",
        `**Verification:** ${VERIFICATION_LABELS[guild.verificationLevel]}`,
        `**Max Members:** ${guild.maximumMembers?.toLocaleString("en-US") ?? "Unlimited"}`,
      ],
      [
        "**🗓️ History**",
        `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
        `**Bot Joined:** <t:${Math.floor(guild.joinedTimestamp / 1000)}:R>`,
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
