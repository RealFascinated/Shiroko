import Command from "@/command/command";
import { PermissionFlags } from "@/permission/permissions";
import ChannelCommand from "./sub/channel.command";
import InfoCommand from "./sub/info.command";
import ToggleCommand from "./sub/toggle.command";

export default class LoggingCommand extends Command {
  constructor() {
    super({ id: "logging", displayName: "Configure server event logs" });

    this.registerSubCommand(new ChannelCommand());
    this.registerSubCommand(new ToggleCommand());
    this.registerSubCommand(new InfoCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LOGGING_COMMAND;
  }
}
