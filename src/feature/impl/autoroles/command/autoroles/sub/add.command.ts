import Command, { type ExecuteContext } from "@/command/command";
import { roleOption, type CommandOptionBuilder } from "@/command/option";
import { autorolesService } from "@/feature/impl/autoroles/autoroles.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";

/**
 * Add a role to the server's autorole list. The role must exist, not be
 * @everyone, and sit at or below the bot's highest role so it is
 * assignable.
 */
export default class AddCommand extends Command {
  constructor() {
    super("add", "Add a role to be granted automatically on join");
  }

  public override get options(): CommandOptionBuilder[] {
    return [roleOption(true, "role", "Role to grant on join")];
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const role = args.role("role");
    if (!role) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("A role is required."))
      );
    }
    if (role.id === guild.id) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(`\`@everyone\` cannot be an autorole.`)
        )
      );
    }
    const me = guild.members.me;
    if (me && role.position >= me.roles.highest.position) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `${role.name} is above my highest role, so I cannot assign it. Move it below my highest role and try again.`
          )
        )
      );
    }

    const wasNew = await autorolesService.add(guild.id, role.id);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("Autoroles")
          .setDescription(`${wasNew ? "Added" : "Already configured"} ${role} as an autorole.`),
      ],
    });
  }
}
