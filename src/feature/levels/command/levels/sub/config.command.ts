import { ChannelType, PermissionFlagsBits } from "discord.js";
import Command, { type ExecuteContext } from "../../../../../command/command";
import {
  booleanOption,
  channelOption,
  integerOption,
  roleOption,
  stringOption,
  type CommandOptionBuilder,
} from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { PermissionFlags } from "../../../../../permission/permissions";
import { levelsService, type LevelConfig } from "../../../levels.service";
import { isXpCurve } from "../../../xp";

const CURVE_CHOICES: Record<string, string> = {
  normal: "Normal",
  easy: "Easy (faster)",
  hard: "Hard (grind)",
};

/**
 * Admin configuration for the levelling feature: curve preset, message XP
 * rate and cooldown, voice XP rate, ignored channels, and level rewards.
 * Guild-only; the parent `/levels` command gates on the LEVELS flag.
 */
export default class ConfigCommand extends Command {
  constructor() {
    super("config", "Configure levelling (curve, rates, rewards)");
    this.slashCommand.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_CONFIG_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      stringOption(false, "curve", "XP curve preset (normal, easy, or hard)", { choices: CURVE_CHOICES }),
      integerOption(false, "message-xp", "XP earned per eligible message"),
      integerOption(false, "message-cooldown", "Minimum seconds between XP-granting messages (10+)", 10),
      integerOption(false, "voice-xp", "XP earned per whole minute in voice chat"),
      channelOption(false, "announce-channel", "Channel where level-ups are announced"),
      roleOption(false, "reward-role", "Role granted at the reward level"),
      integerOption(false, "reward-level", "Level that unlocks the reward role"),
      booleanOption(false, "reward-clear", "Remove the reward at that level instead of setting one"),
    ];
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const updates: Partial<LevelConfig> = {};

    const curveRaw = ctx.options.getString("curve");
    if (curveRaw !== null) {
      if (!isXpCurve(curveRaw)) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription(`Unknown curve: \`${curveRaw}\`.`)
          )
        );
      }
      updates.curve = curveRaw;
    }

    const messageXp = ctx.options.getInteger("message-xp");
    if (messageXp !== null) {
      if (messageXp < 1) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Message XP must be at least 1.")
          )
        );
      }
      updates.messageXp = messageXp;
    }

    const cooldown = ctx.options.getInteger("message-cooldown");
    if (cooldown !== null) {
      // A floor of 10s prevents a cooldown of 0; with no cooldown, every
      // message grants XP and the system is trivially farmable.
      if (cooldown < 10) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Cooldown must be at least 10 seconds.")
          )
        );
      }
      updates.messageCooldownSeconds = cooldown;
    }

    const voiceXp = ctx.options.getInteger("voice-xp");
    if (voiceXp !== null) {
      if (voiceXp < 1) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Voice XP must be at least 1.")
          )
        );
      }
      updates.voiceXpPerMin = voiceXp;
    }

    const announceChannel = ctx.options.getChannel("announce-channel");
    if (announceChannel) {
      const isText =
        announceChannel.type === ChannelType.GuildText ||
        announceChannel.type === ChannelType.GuildAnnouncement ||
        announceChannel.type === ChannelType.PublicThread ||
        announceChannel.type === ChannelType.PrivateThread;
      if (!isText) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Announce channel must be a text channel.")
          )
        );
      }
      updates.announceChannelId = announceChannel.id;
    }

    const rewardLevelRaw = ctx.options.getInteger("reward-level");
    const role = ctx.options.getRole("reward-role");
    const rewardClear = ctx.options.getBoolean("reward-clear");

    if (role !== null || rewardLevelRaw !== null || rewardClear !== null) {
      if (rewardLevelRaw === null) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Setting or clearing a reward requires `reward-level`.")
          )
        );
      }
      if (rewardLevelRaw < 1) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Reward levels start at 1.")
          )
        );
      }
      if (rewardClear === true) {
        await levelsService.removeReward(guild.id, rewardLevelRaw);
        return ctx.reply({
          embeds: [
            baseEmbed(commandName)
              .setTitle("🏅 Reward Removed")
              .setDescription(`Removed the level **${rewardLevelRaw}** reward.`),
          ],
        });
      }
      if (role === null) {
        return ctx.reply(
          ephemeralErrorReply(
            commandName,
            errorEmbed(commandName).setDescription("Provide a role to set as the reward.")
          )
        );
      }
      await levelsService.setRewardRole(guild, rewardLevelRaw, role.id);
      return ctx.reply({
        embeds: [
          baseEmbed(commandName)
            .setTitle("🏅 Reward Set")
            .setDescription(`Level **${rewardLevelRaw}** now grants **@${role.name}**.`),
        ],
      });
    }

    const changed = (
      ["curve", "messageXp", "messageCooldownSeconds", "voiceXpPerMin", "announceChannelId"] as const
    ).filter(label => label in updates);

    const config = await levelsService.setConfig(guild.id, updates);
    const lines = [
      `Curve: **${config.curve}**`,
      `Message XP: **${config.messageXp}** (cooldown **${config.messageCooldownSeconds}s**)`,
      `Voice XP: **${config.voiceXpPerMin}**/min`,
      `Ignored channels: ${
        config.ignoredChannelIds.length === 0
          ? "none"
          : config.ignoredChannelIds.map(id => `<#${id}>`).join(", ")
      }`,
      `Announce channel: ${config.announceChannelId ? `<#${config.announceChannelId}>` : "none"}`,
    ];
    const embed = baseEmbed(commandName)
      .setTitle("⚙️ Levelling Config")
      .setDescription(`**Updated** ${changed.join(", ")}.\n${lines.join("\n")}`);
    return ctx.reply({ embeds: [embed] });
  }
}
