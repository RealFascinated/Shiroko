import Command, { type ExecuteContext } from "@/command/command";
import { autorolesService } from "@/feature/impl/autoroles/autoroles.service";
import { baseEmbed } from "@/lib/embed";
import { pluralise } from "@/lib/format";
import type { EmbedBuilder } from "discord.js";

/**
 * Grant every missing autorole across the guild's existing members. Useful
 * after configuring a role that predates the autorole, or to repair grants
 * that failed on join.
 */
export default class SyncCommand extends Command {
  constructor() {
    super("sync", "Grant missing autoroles to existing members");
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext): Promise<void> {
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

    await ctx.deferReply();
    const result = await autorolesService.syncToGuild(guild, async (scanned, total) => {
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
      embeds: [baseEmbed(commandName).setTitle("Autoroles synced").setDescription(lines.join("\n"))],
    });
  }
}

/**
 * The in-progress card, redrawn every 100 members and once the sweep ends.
 */
function progressEmbed(command: string, scanned: number, total: number): EmbedBuilder {
  return baseEmbed(command)
    .setTitle("Syncing autoroles")
    .setDescription(
      `Checking ${scanned.toLocaleString("en-US")}/${total.toLocaleString("en-US")} members...`
    );
}
