import Command from "@/command/command";
import { PermissionFlags } from "@/permission/permissions";
import AddCommand from "./sub/add.command";
import RemoveCommand from "./sub/remove.command";
import ShowCommand from "./sub/show.command";
import SyncCommand from "./sub/sync.command";

/**
 * Manage autoroles: roles granted automatically to members on joining.
 * Admin-gated via the parent's `requiredFlags`; subcommands inherit it.
 */
export default class AutorolesCommand extends Command {
  constructor() {
    super({ id: "autoroles", displayName: "Automatically grant roles to members when they join" });

    this.registerSubCommand(new AddCommand());
    this.registerSubCommand(new RemoveCommand());
    this.registerSubCommand(new ShowCommand());
    this.registerSubCommand(new SyncCommand());
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.AUTOROLE_COMMAND;
  }
}
