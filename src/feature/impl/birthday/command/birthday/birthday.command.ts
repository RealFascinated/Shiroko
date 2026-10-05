import Command from "@/command/command";
import RemoveCommand from "./sub/remove.command";
import SetCommand from "./sub/set.command";
import UpcomingCommand from "./sub/upcoming.command";
import ViewCommand from "./sub/view.command";

export default class BirthdayCommand extends Command {
  constructor() {
    super({ id: "birthday", displayName: "Save your birthday and see upcoming ones" });

    this.registerSubCommand(new SetCommand());
    this.registerSubCommand(new RemoveCommand());
    this.registerSubCommand(new ViewCommand());
    this.registerSubCommand(new UpcomingCommand());
  }
}
