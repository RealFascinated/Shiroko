import { getGif } from "../../lib/anime";
import { baseEmbed } from "../../lib/embed";
import Command, { type ExecuteContext } from "../command";

export default class BlehCommand extends Command {
  constructor() {
    super("bleh", "Express your displeasure with a bleh anime gif");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const gif = await getGif("bleh");

    return ctx.reply({
      embeds: [baseEmbed(commandName).setTitle(`${ctx.user.displayName} feels bleh`).setImage(gif.url)],
    });
  }
}
