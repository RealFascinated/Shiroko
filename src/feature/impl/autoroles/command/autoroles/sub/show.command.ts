import Command, { type ExecuteContext } from "@/command/command";
import { autorolesService } from "@/feature/impl/autoroles/autoroles.service";
import { baseEmbed } from "@/lib/embed";

/**
 * List the roles configured to be granted automatically on join.
 */
export default class ShowCommand extends Command {
  constructor() {
    super({ id: "show", displayName: "List the server's autoroles" });
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const roles = await autorolesService.list(guild);
    if (roles.length === 0) {
      return ctx.reply({
        embeds: [
          baseEmbed(commandName)
            .setTitle("Autoroles")
            .setDescription(`No autoroles are configured in this server.`),
        ],
      });
    }
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("Autoroles")
          .setDescription(roles.map(role => `<@&${role.id}>`).join("\n")),
      ],
    });
  }
}
