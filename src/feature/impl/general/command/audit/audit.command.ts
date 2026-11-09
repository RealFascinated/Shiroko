import Command from "@/command/command";
import { PermissionFlags } from "@/permission/permissions";
import ConfigCommand from "./sub/config.command";
import RevertCommand from "./sub/revert.command";
import ServerCommand from "./sub/server.command";
import UserCommand from "./sub/user.command";

export default class AuditCommand extends Command {
  constructor() {
    super({ id: "audit", displayName: "Review recorded changes and undo configuration changes" });
    this.registerSubCommand(new UserCommand());
    this.registerSubCommand(new ServerCommand());
    this.registerSubCommand(new ConfigCommand());
    this.registerSubCommand(new RevertCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.AUDIT_COMMAND;
  }
}
