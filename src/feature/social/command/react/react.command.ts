import Command from "../../../../command/command";
import AngryCommand from "./sub/angry.command";
import BlehCommand from "./sub/bleh.command";
import BlushCommand from "./sub/blush.command";
import BoredCommand from "./sub/bored.command";
import ConfusedCommand from "./sub/confused.command";
import CryCommand from "./sub/cry.command";
import HappyCommand from "./sub/happy.command";
import LaughCommand from "./sub/laugh.command";
import PoutCommand from "./sub/pout.command";
import ShockedCommand from "./sub/shocked.command";
import SleepCommand from "./sub/sleep.command";
import SmugCommand from "./sub/smug.command";

export default class ReactCommand extends Command {
  constructor() {
    super("react", "React with a mood");

    this.registerSubCommand(new AngryCommand());
    this.registerSubCommand(new BlehCommand());
    this.registerSubCommand(new BlushCommand());
    this.registerSubCommand(new BoredCommand());
    this.registerSubCommand(new ConfusedCommand());
    this.registerSubCommand(new CryCommand());
    this.registerSubCommand(new HappyCommand());
    this.registerSubCommand(new LaughCommand());
    this.registerSubCommand(new PoutCommand());
    this.registerSubCommand(new ShockedCommand());
    this.registerSubCommand(new SleepCommand());
    this.registerSubCommand(new SmugCommand());
  }

  public override get userInstallable(): boolean {
    return true;
  }
}
