import Command, { type ExecuteContext } from "@/command/command";
import { autorolesService } from "@/feature/impl/autoroles/autoroles.service";
import { baseEmbed } from "@/lib/embed";
import { replyWithSync } from "@/lib/sync-reply";

/**
 * Grant every missing autorole across the guild's existing members. Useful
 * after configuring a role that predates the autorole, or to repair grants
 * that failed on join.
 */
export default class SyncCommand extends Command {
  constructor() {
    super({ id: "sync", displayName: "Grant missing autoroles to existing members" });
  }

  protected override async onExecuteSlash(context: ExecuteContext): Promise<void> {
    const { ctx, commandName } = context;
    const guild = ctx.guild!;
    const roles = await autorolesService.list(guild);
    if (roles.length === 0) {
      await ctx.reply({
        embeds: [
          baseEmbed(commandName)
            .setTitle("Autoroles")
            .setDescription("No autoroles are configured in this server."),
        ],
      });
      return;
    }
    await replyWithSync(context, "autoroles", onProgress => autorolesService.syncToGuild(guild, onProgress));
  }
}
