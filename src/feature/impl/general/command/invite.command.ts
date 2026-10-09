import Command, { type ExecuteContext } from "@/command/command";
import { Constants } from "@/constants";
import { baseEmbed } from "@/lib/embed";

export default class InviteCommand extends Command {
  constructor() {
    super({ id: "invite", displayName: "Get the bot's invite link" });
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    return ctx.reply({
      embeds: [baseEmbed(commandName).setDescription(`You can invite Arona [here](${Constants.inviteUrl})`)],
    });
  }
}
