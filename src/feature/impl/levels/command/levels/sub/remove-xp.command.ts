import Command, { type ExecuteContext } from "@/command/command";
import { integerOption, userOption, type CommandOptionBuilder } from "@/command/option";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { baseEmbed } from "@/lib/embed";
import { PermissionFlags } from "@/permission/permissions";

/**
 * Take XP from a member, floored at 0. Reward roles they already hold are
 * kept. Gated by `LEVELS_ADMIN`.
 */
export default class RemoveXpCommand extends Command {
  constructor() {
    super({ id: "remove-xp", displayName: "Remove XP from a member" });
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_ADMIN;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      userOption(true, "user", "Member to remove XP from"),
      integerOption(true, "amount", "XP to remove", 1, 1_000_000),
    ];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const target = ctx.options.getUser("user", true);
    const amount = ctx.options.getInteger("amount", true);
    const result = await levelsService.removeXp(guild.id, target.id, amount);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("✨ XP Removed")
          .setDescription(
            `Removed up to **${amount.toLocaleString()} XP** from ${target}. They now have **${result.xp.toLocaleString()} XP** (level ${result.level}).`
          ),
      ],
    });
  }
}
