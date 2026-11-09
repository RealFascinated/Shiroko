import Command, { type ExecuteContext } from "@/command/command";
import { roleOption, type CommandOptionBuilder } from "@/command/option";
import { baseEmbed } from "@/lib/embed";
import Permissions from "@/permission/permissions";

export default class PermissionsClearCommand extends Command {
  constructor() {
    super({ id: "clear", displayName: "Remove a role's permission configuration" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [roleOption(true, "role", "Role to clear")];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const role = ctx.options.getRole("role", true);
    await Permissions.clearRole(guild, role.id, { guild, userId: ctx.user.id });
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🔒 Permissions Cleared")
          .setDescription(`**${role.name}** now defaults to no permissions.`),
      ],
    });
  }
}
