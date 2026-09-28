import Command from "../../../../../command/command";
import RemoveCommand from "./sub/remove.command";
import SetCommand from "./sub/set.command";
import UpcomingCommand from "./sub/upcoming.command";

export default class BirthdayCommand extends Command {
  constructor() {
    super("birthday", "Save your birthday and see upcoming ones");

    this.registerSubCommand(new SetCommand());
    this.registerSubCommand(new RemoveCommand());
    this.registerSubCommand(new UpcomingCommand());
  }
}
