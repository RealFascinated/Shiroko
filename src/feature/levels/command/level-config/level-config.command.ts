import { PermissionFlagsBits } from "discord.js";
import Command from "../../../../command/command";
import { PermissionFlags } from "../../../../permission/permissions";
import AddRoleCommand from "./sub/add-role.command";
import AnnounceChannelCommand from "./sub/announce-channel.command";
import IgnoredChannelsCommand from "./sub/ignored-channels.command";
import MessageXpCooldownCommand from "./sub/message-xp-cooldown.command";
import MessageXpCommand from "./sub/message-xp.command";
import RemoveRoleCommand from "./sub/remove-role.command";
import ViewCommand from "./sub/view.command";
import VoiceXpCommand from "./sub/voice-xp.command";

/**
 * Admin configuration for the levelling feature, one subcommand per
 * setting so each can be configured independently: message XP rate,
 * message cooldown, voice XP rate, announce channel, ignored channels,
 * level-up reward roles. Guild-only; the parent gates the whole command
 * on the LEVELS flag, mirroring `/permissions`.
 */
export default class LevelConfigCommand extends Command {
  constructor() {
    super("level-config", "Configure levelling (rates, channels, rewards)");
    this.slashCommand.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

    this.registerSubCommand(new ViewCommand());
    this.registerSubCommand(new MessageXpCommand());
    this.registerSubCommand(new MessageXpCooldownCommand());
    this.registerSubCommand(new VoiceXpCommand());
    this.registerSubCommand(new AnnounceChannelCommand());
    this.registerSubCommand(new IgnoredChannelsCommand());
    this.registerSubCommand(new AddRoleCommand());
    this.registerSubCommand(new RemoveRoleCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_CONFIG_COMMAND;
  }
}
