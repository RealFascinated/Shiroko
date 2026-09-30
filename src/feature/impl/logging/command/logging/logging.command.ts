import Command from "@/command/command";
import { PermissionFlags } from "@/permission/permissions";
import ChannelCommand from "./sub/channel.command";
import ToggleCommand from "./sub/toggle.command";

/**
 * Configure the logging feature: which channel receives logs and which log
 * types are enabled. Gated via the parent's `requiredFlags`; subcommands
 * inherit it.
 */
export default class LoggingCommand extends Command {
  constructor() {
    super("logging", "Configure server event logs");

    this.registerSubCommand(new ChannelCommand());
    this.registerSubCommand(new ToggleCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LOGGING_COMMAND;
  }
}
