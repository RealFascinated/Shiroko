import Command, { type ExecuteContext } from "@/command/command";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { pluralise } from "@/lib/format";
import { PermissionFlags } from "@/permission/permissions";
import type { EmbedBuilder } from "discord.js";

/**
 * Grant every unlocked reward role members are missing. Useful after
 * configuring a reward members already out-levelled, for members who left
 * and re-joined, and to repair grants that failed while the bot was
 * offline. Gated by `LEVELS_COMMAND`; the rest of `/levels` stays open.
 */
export default class SyncRewardsCommand extends Command {
  constructor() {
    super({ id: "sync-rewards", displayName: "Grant missing level reward roles to members" });
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_COMMAND;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext): Promise<void> {
    const guild = ctx.guild!;
    const rewards = await levelsService.rewards(guild.id);
    if (!rewards.some(reward => reward.type === "Role" && reward.roleId)) {
      await ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            "No role rewards are configured. Add one with `/levels reward-add`."
          )
        )
      );
      return;
    }

    await ctx.deferReply();
    const result = await levelsService.syncRewardsToGuild(guild, async (scanned, total) => {
      await ctx.editReply({ embeds: [progressEmbed(commandName, scanned, total)] });
    });

    const lines = [
      `Checked ${result.scanned.toLocaleString("en-US")} ${pluralise(result.scanned, "member")}.`,
      `Granted ${result.granted.toLocaleString("en-US")} ${pluralise(result.granted, "role")} to ${result.changed.toLocaleString("en-US")} ${pluralise(result.changed, "member")}.`,
    ];
    if (result.failed > 0) {
      lines.push(
        `${result.failed.toLocaleString("en-US")} ${pluralise(result.failed, "member")} could not be updated.`
      );
    }
    await ctx.editReply({
      embeds: [baseEmbed(commandName).setTitle("Level rewards synced").setDescription(lines.join("\n"))],
    });
  }
}

/**
 * The in-progress card, redrawn every 100 members and once the sweep ends.
 */
function progressEmbed(command: string, scanned: number, total: number): EmbedBuilder {
  return baseEmbed(command)
    .setTitle("Syncing level rewards")
    .setDescription(
      `Checking ${scanned.toLocaleString("en-US")}/${total.toLocaleString("en-US")} members...`
    );
}
