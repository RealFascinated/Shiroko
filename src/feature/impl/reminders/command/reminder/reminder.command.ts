import Command from "@/command/command";
import ClearCommand from "./sub/clear.command";
import DeleteCommand from "./sub/delete.command";
import ListCommand from "./sub/list.command";
import SetCommand from "./sub/set.command";

/**
 * `/reminder`: schedule, inspect, and cancel your own reminders. A command
 * with subcommands cannot be invoked directly, so the parent has no body.
 * It is user-installable so the family works outside guilds, which is what
 * lets a reminder be set from a DM.
 */
export default class ReminderCommand extends Command {
  constructor() {
    super({ id: "reminder", displayName: "Schedule a reminder for yourself" });

    this.registerSubCommand(new SetCommand());
    this.registerSubCommand(new DeleteCommand());
    this.registerSubCommand(new ClearCommand());
    this.registerSubCommand(new ListCommand());
  }

  public override get userInstallable(): boolean {
    return true;
  }
}
