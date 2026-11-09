import Command from "@/command/command";
import { PermissionFlags } from "@/permission/permissions";
import ConfigCommand from "./sub/config.command";
import GuildCommand from "./sub/guild.command";
import ConfigRevertCommand from "./sub/config-revert.command";
import UserCommand from "./sub/user.command";

export default class AuditCommand extends Command {
  constructor() {
    super({ id: "audit", displayName: "Review recorded changes and undo configuration changes" });
    this.registerSubCommand(new UserCommand());
    this.registerSubCommand(new GuildCommand());
    this.registerSubCommand(new ConfigCommand());
    this.registerSubCommand(new ConfigRevertCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.AUDIT_LOG_COMMAND;
  }
}
