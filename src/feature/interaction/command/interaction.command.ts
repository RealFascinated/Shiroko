import Command, { type ExecuteContext } from "../../../command/command";
import HugCommand from "./sub/hug.command";

export default class InteractionCommand extends Command {
  constructor() {
    super("interact", "Interact with others");

    this.registerSubCommand(new HugCommand());
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx }: ExecuteContext) {
    return ctx.reply("Choose a subcommand: /interact hug");
  }
}
