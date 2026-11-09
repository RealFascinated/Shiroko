import type { Role } from "discord.js";
import Command, { type ExecuteContext } from "@/command/command";
import { roleOption, type CommandOptionBuilder } from "@/command/option";
import { autorolesService } from "@/feature/impl/autoroles/autoroles.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { unassignableReason } from "@/lib/roles";

export default class AddCommand extends Command {
  constructor() {
    super({ id: "add", displayName: "Add a role to be granted automatically on join" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [roleOption(true, "role", "Role to grant on join")];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const role = ctx.options.getRole("role", true) as Role;
    const reason = unassignableReason(role, "an autorole");
    if (reason) {
      return ctx.reply(ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription(reason)));
    }

    const wasNew = await autorolesService.add(guild, role.id, ctx.user.id);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("Autoroles")
          .setDescription(`${wasNew ? "Added" : "Already configured"} ${role} as an autorole.`),
      ],
    });
  }
}
