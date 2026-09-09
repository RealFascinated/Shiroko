import Command, { type ExecuteContext } from "../../../command/command";
import { roleOption, stringOption, type CommandOptionBuilder } from "../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../lib/embed";
import Permissions, { flagLabels } from "../../permissions";
import { parseFlags } from "./permissions-helpers";

/**
 * Set a role's own flags, replacing previous. Optional parent for inheritance.
 */
export default class PermissionsSetCommand extends Command {
  constructor() {
    super("set", "Set a role's permission flags");
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      roleOption(true, "role", "Role to configure"),
      stringOption(
        true,
        "flags",
        "Permission flags to grant (repeat the option for multiple; 'none' clears)"
      ),
      roleOption(false, "parent", "Parent role to inherit from"),
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
    const flagChoice = ctx.options.getString("flags", true)!;
    const flags = parseFlags([flagChoice]);
    const parent = args.role("parent");
    try {
      const effective = await Permissions.setRole(guild.id, role.id, flags, parent ? parent.id : null);
      return ctx.reply({
        embeds: [
          baseEmbed(commandName)
            .setTitle("🔒 Permissions Updated")
            .setDescription(
              `**${role.name}** now has: ${flagLabels(effective).join(", ") || "no flags"}${
                parent ? ` (inherits from @${parent.name})` : ""
              }`
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
