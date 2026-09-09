import { PermissionFlags } from "../permissions";
import Command from "../../command/command";
import ClearCommand from "./sub/clear.command";
import InheritCommand from "./sub/inherit.command";
import SetCommand from "./sub/set.command";
import ViewCommand from "./sub/view.command";

export default class PermissionsCommand extends Command {
  constructor() {
    super("permissions", "Manage role permissions");

    this.registerSubCommand(new ViewCommand());
    this.registerSubCommand(new SetCommand());
    this.registerSubCommand(new InheritCommand());
    this.registerSubCommand(new ClearCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.PERMISSIONS_COMMAND;
  }
}
