import Command, { type ExecuteContext } from "@/command/command";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { replyWithSync } from "@/lib/sync-reply";
import { PermissionFlags } from "@/permission/permissions";

/**
 * Grant every unlocked reward role members are missing. Useful after
 * configuring a reward members already out-levelled, for members who left
 * and re-joined, and to repair grants that failed while the bot was
 * offline. Gated by `LEVELS_ADMIN`; the rest of `/levels` stays open.
 */
export default class SyncRewardsCommand extends Command {
  constructor() {
    super({ id: "sync-rewards", displayName: "Grant missing level reward roles to members" });
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_ADMIN;
  }

  protected override async onExecuteSlash(context: ExecuteContext): Promise<void> {
    const { ctx, commandName } = context;
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

    await replyWithSync(context, "level rewards", onProgress =>
      levelsService.syncRewardsToGuild(guild, onProgress)
    );
  }
}
