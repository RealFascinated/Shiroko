import Command, { type ExecuteContext } from "@/command/command";
import { stringOption, type CommandOptionBuilder } from "@/command/option";
import { afkService } from "../afk.service";
import { cleanReason, MAX_REASON_LENGTH } from "../afk-text";

export default class AfkCommand extends Command {
  constructor() {
    super({ id: "afk", displayName: "Mark yourself as away" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [stringOption(false, "reason", `Why you are away (up to ${MAX_REASON_LENGTH} characters)`)];
  }

  protected override async onExecuteSlash({ user, ctx, args }: ExecuteContext) {
    const reason = cleanReason(args.string("reason"));
    await afkService.set(ctx.guild!.id, user.id, reason);
    return ctx.reply({
      content: `💤 You are now AFK${reason ? `: **${reason}**` : ""}.`,
      allowedMentions: { parse: [] },
    });
  }
}
