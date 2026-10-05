import Command, { type ExecuteContext } from "@/command/command";
import { integerOption, roleOption, type CommandOptionBuilder } from "@/command/option";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { PermissionFlags } from "@/permission/permissions";

/**
 * Grant a role when a member reaches a level. The level must be at least 1,
 * and the role must be assignable: not `@everyone`, and at or below the
 * bot's highest role. Gated by `LEVELS_COMMAND`; the rest of `/levels`
 * stays open.
 */
export default class RewardAddCommand extends Command {
  constructor() {
    super({ id: "reward-add", displayName: "Grant a role when a member reaches a level" });
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      integerOption(true, "level", "Level at which the role is granted", 1),
      roleOption(true, "role", "Role to grant at that level"),
    ];
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const level = ctx.options.getInteger("level", true);
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
          errorEmbed(commandName).setDescription("`@everyone` cannot be a level reward.")
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

    await levelsService.setRewardRole(guild, level, role.id);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🏅 Level Reward Set")
          .setDescription(`${role} will be granted at **level ${level}**.`),
      ],
    });
  }
}
