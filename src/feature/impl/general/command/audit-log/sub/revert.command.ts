import AuditLog from "@/audit/audit-log";
import { AUDIT_KINDS } from "@/audit/kinds";
import Command, { type ExecuteContext } from "@/command/command";
import { integerOption, type CommandOptionBuilder } from "@/command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { fetchGuildMember } from "@/lib/guild";
import Permissions from "@/permission/permissions";

export default class AuditLogRevertCommand extends Command {
  constructor() {
    super({ id: "revert", displayName: "Restore the value from before a change" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [integerOption(true, "id", "The entry number shown in /audit-log view", 1)];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const fail = (message: string) =>
      ctx.reply(ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription(message)));
    const entry = await AuditLog.get(guild.id, ctx.options.getInteger("id", true));
    const kind = entry ? AUDIT_KINDS[entry.kind] : undefined;
    if (!entry || !kind) {
      return fail("No audit log entry with that number.");
    }
    const member = await fetchGuildMember(guild, ctx.user.id);
    if (!member || !(await Permissions.memberHas(guild, member, kind.revertFlags))) {
      return fail("You don't have permission to revert that kind of change.");
    }
    try {
      await kind.revert(entry, { guild, userId: ctx.user.id });
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("↩️ Change Reverted")
          .setDescription(`Entry **#${entry.id}** was undone.\n${kind.describe(entry)}`),
      ],
    });
  }
}
