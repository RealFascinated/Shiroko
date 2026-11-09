import Command from "@/command/command";
import { PermissionFlags } from "@/permission/permissions";
import RevertCommand from "./sub/revert.command";
import ViewCommand from "./sub/view.command";

export default class AuditLogCommand extends Command {
  constructor() {
    super({ id: "audit-log", displayName: "Review and undo configuration changes" });

    this.registerSubCommand(new ViewCommand());
    this.registerSubCommand(new RevertCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.AUDIT_LOG_COMMAND;
  }
}
