import Command, { type ExecuteContext } from "@/command/command";
import { integerOption, userOption, type CommandOptionBuilder } from "@/command/option";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { PermissionFlags } from "@/permission/permissions";

// Keeps `xp + amount` well inside the int4 `xp` column.
const MAX_AMOUNT = 1_000_000;

/**
 * Add XP to a member. Crossing a level posts a `LevelUpEvent`, so rewards
 * and announcements fire as if the XP was earned. Gated by `LEVELS_ADMIN`.
 */
export default class GiveXpCommand extends Command {
  constructor() {
    super({ id: "give-xp", displayName: "Give XP to a member" });
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_ADMIN;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      userOption(true, "user", "Member to give XP to"),
      integerOption(true, "amount", "XP to give", 1, MAX_AMOUNT),
    ];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const target = ctx.options.getUser("user", true);
    const amount = ctx.options.getInteger("amount", true);
    if (target.bot) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("Bots don't level up."))
      );
    }

    const result = await levelsService.giveXp(guild, target, amount);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("✨ XP Given")
          .setDescription(
            `Gave **${amount.toLocaleString()} XP** to ${target}. They now have **${(result?.xp ?? 0).toLocaleString()} XP** (level ${result?.level ?? 1}).`
          ),
      ],
    });
  }
}
