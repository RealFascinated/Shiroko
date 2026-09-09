import Command, { type ExecuteContext } from "../../../command/command";
import { roleOption, type CommandOptionBuilder } from "../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../lib/embed";
import Permissions from "../../permissions";

/**
 * Delete a role's permission row entirely; it then resolves to no flags.
 */
export default class PermissionsClearCommand extends Command {
  constructor() {
    super("clear", "Remove a role's permission configuration");
  }

  public override get options(): CommandOptionBuilder[] {
    return [roleOption(true, "role", "Role to clear")];
  }

  protected override async onExecuteSlash({ guild, ctx, args, commandName }: ExecuteContext) {
    if (!guild) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Permissions are only available in servers.")
        )
      );
    }
    const role = args.role("role");
    if (!role) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("A role is required."))
      );
    }
    await Permissions.clearRole(guild.id, role.id);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🔒 Permissions Cleared")
          .setDescription(`**${role.name}** now defaults to no flags.`),
      ],
    });
  }
}
