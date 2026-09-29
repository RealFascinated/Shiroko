import Command, { type ExecuteContext } from "@/command/command";
import { roleOption, type CommandOptionBuilder } from "@/command/option";
import { autorolesService } from "@/feature/impl/autoroles/autoroles.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";

/**
 * Remove a role from the server's autorole list.
 */
export default class RemoveCommand extends Command {
  constructor() {
    super("remove", "Remove an autorole");
  }

  public override get options(): CommandOptionBuilder[] {
    return [roleOption(true, "role", "Role to stop granting on join")];
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const role = args.role("role");
    if (!role) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("A role is required."))
      );
    }

    const removed = await autorolesService.remove(guild.id, role.id);
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
