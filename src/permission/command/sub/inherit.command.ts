import Command, { type ExecuteContext } from "../../../command/command";
import { roleOption, type CommandOptionBuilder } from "../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../lib/embed";
import Permissions, { flagLabels } from "../../permissions";

/**
 * Change only a role's parent link, leaving own permissions untouched.
 */
export default class PermissionsInheritCommand extends Command {
  constructor() {
    super("inherit", "Set or clear a role's parent for inheritance");
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      roleOption(true, "role", "Role to update"),
      roleOption(false, "parent", "Parent role (omit to clear)"),
    ];
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
    const parent = args.role("parent");
    try {
      const effective = await Permissions.setParent(guild.id, role.id, parent?.id ?? null);
      return ctx.reply({
        embeds: [
          baseEmbed(commandName)
            .setTitle("🔒 Permissions Updated")
            .setDescription(
              `**${role.name}** now inherits from ${
                parent ? `@${parent.name}` : "nothing"
              }. Effective permissions: ${flagLabels(effective).join(", ") || "no permissions"}.`
            ),
        ],
      });
    } catch (error) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(error instanceof Error ? error.message : String(error))
        )
      );
    }
  }
}
