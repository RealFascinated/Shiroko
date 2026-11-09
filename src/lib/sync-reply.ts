import type { ExecuteContext } from "@/command/command";
import { baseEmbed } from "@/lib/embed";
import { formatCount, pluralise, titleCase } from "@/lib/format";
import type { MemberSyncProgress, MemberSyncResult } from "@/lib/member-sync";

/**
 * Defer, redraw a progress card as the sync runs, then replace it with the
 * result summary. `subject` names what is synced, e.g. "autoroles".
 */
export async function replyWithSync(
  { ctx, commandName }: Pick<ExecuteContext, "ctx" | "commandName">,
  subject: string,
  sync: (onProgress: MemberSyncProgress) => Promise<MemberSyncResult>
): Promise<void> {
  await ctx.deferReply();
  const result = await sync(async (scanned, total) => {
    await ctx.editReply({
      embeds: [
        baseEmbed(commandName)
          .setTitle(`Syncing ${subject}`)
          .setDescription(`Checking ${formatCount(scanned)}/${formatCount(total)} members...`),
      ],
    });
  });
  const lines = [
    `Checked ${formatCount(result.scanned)} ${pluralise(result.scanned, "member")}.`,
    `Granted ${formatCount(result.granted)} ${pluralise(result.granted, "role")} to ${formatCount(result.changed)} ${pluralise(result.changed, "member")}.`,
  ];
  if (result.failed > 0) {
    lines.push(`${formatCount(result.failed)} ${pluralise(result.failed, "member")} could not be updated.`);
  }
  await ctx.editReply({
    embeds: [
      baseEmbed(commandName)
        .setTitle(`${titleCase(subject)} synced`)
        .setDescription(lines.join("\n")),
    ],
  });
}
