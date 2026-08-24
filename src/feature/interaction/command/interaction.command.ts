import Command, { type ExecuteContext } from "../../../command/command";
import HugCommand from "./sub/hug.command";
import KissCommand from "./sub/kiss.command";
import PatCommand from "./sub/pat.command";
import SlapCommand from "./sub/slap.command";

export default class InteractionCommand extends Command {
  constructor() {
    super("interact", "Interact with others");

    this.registerSubCommand(new HugCommand());
    this.registerSubCommand(new KissCommand());
    this.registerSubCommand(new SlapCommand());
    this.registerSubCommand(new PatCommand());
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx }: ExecuteContext) {
    return ctx.reply("Choose a subcommand: /interact hug");
  }
}
