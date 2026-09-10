import { PermissionFlagsBits } from "discord.js";
import Command from "../../../../command/command";
import { PermissionFlags } from "../../../../permission/permissions";
import AnnounceCommand from "./sub/announce.command";
import IgnoredChannelsCommand from "./sub/ignored-channels.command";
import MessageCommand from "./sub/message.command";
import RewardCommand from "./sub/reward.command";
import ViewCommand from "./sub/view.command";
import VoiceCommand from "./sub/voice.command";

/**
 * Admin configuration for the levelling feature, one subcommand per
 * setting so each can be configured independently: message rate and
 * cooldown, voice rate, announce channel, ignored channels, rewards.
 * Guild-only; every subcommand gates on the LEVELS flag via its own
 * `requiredFlags`, mirroring `/permissions`.
 */
export default class LevelConfigCommand extends Command {
  constructor() {
    super("level-config", "Configure levelling (rates, channels, rewards)");
    this.slashCommand.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

    this.registerSubCommand(new ViewCommand());
    this.registerSubCommand(new MessageCommand());
    this.registerSubCommand(new VoiceCommand());
    this.registerSubCommand(new AnnounceCommand());
    this.registerSubCommand(new IgnoredChannelsCommand());
    this.registerSubCommand(new RewardCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_CONFIG_COMMAND;
  }
}
