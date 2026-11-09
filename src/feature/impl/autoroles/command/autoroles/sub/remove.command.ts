import Command, { type ExecuteContext } from "@/command/command";
import { roleOption, type CommandOptionBuilder } from "@/command/option";
import { autorolesService } from "@/feature/impl/autoroles/autoroles.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";

export default class RemoveCommand extends Command {
  constructor() {
    super({ id: "remove", displayName: "Remove an autorole" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [roleOption(true, "role", "Role to stop granting on join")];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const role = ctx.options.getRole("role", true);

    const removed = await autorolesService.remove(guild, role.id, ctx.user.id);
    if (!removed) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(`That role was not configured as an autorole.`)
        )
      );
    }
    return ctx.reply({
      embeds: [
        baseEmbed(commandName).setTitle("Autoroles").setDescription(`Removed ${role} from autoroles.`),
      ],
    });
  }
}
