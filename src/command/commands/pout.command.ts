import { getGif } from "../../lib/anime";
import { baseEmbed } from "../../lib/embed";
import Command, { type ExecuteContext } from "../command";

export default class PoutCommand extends Command {
  constructor() {
    super("pout", "Send a pouty anime gif");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const gif = await getGif("pout");

    return ctx.reply({
      embeds: [baseEmbed(commandName).setTitle("Pout").setImage(gif.url)],
    });
  }
}
