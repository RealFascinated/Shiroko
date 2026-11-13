import Command, { type ExecuteContext } from "@/command/command";
import { MessageFlags } from "discord.js";
import { marriageService } from "../../../marriage.service";

export default class DivorceCommand extends Command {
  constructor() {
    super({ id: "divorce", displayName: "End your marriage in this server" });
  }

  protected override async onExecuteSlash({ user, ctx }: ExecuteContext) {
    const partnerId = await marriageService.divorce(ctx.guild!.id, user.id);
    if (!partnerId) {
      return ctx.reply({ content: "You are not married in this server.", flags: MessageFlags.Ephemeral });
    }
    return ctx.reply({
      content: `💔 You are no longer married to <@${partnerId}>.`,
      allowedMentions: { parse: [] },
    });
  }
}
