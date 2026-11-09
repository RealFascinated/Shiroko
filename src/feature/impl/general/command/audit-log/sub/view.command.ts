import AuditLog from "@/audit/audit-log";
import { AUDIT_KINDS } from "@/audit/kinds";
import Command, { type ExecuteContext } from "@/command/command";
import { stringOption, userOption, type CommandOptionBuilder } from "@/command/option";
import type { GuildAuditLogSchema } from "@/db/schemas/guild-audit-log";
import { baseEmbed } from "@/lib/embed";
import { createPager, type Page } from "@/lib/pagination";

const ENTRIES_PER_PAGE = 8;

export default class AuditLogViewCommand extends Command {
  constructor() {
    super({ id: "view", displayName: "View recent configuration changes" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      stringOption(false, "key", "A setting key or module, like levels or levels.messageXp"),
      userOption(false, "user", "Only changes made by this user"),
    ];
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const filter = { key: args.string("key") ?? undefined, userId: args.user("user")?.id };
    const fetchPage = (page: number) => AuditLog.page(guild.id, page, ENTRIES_PER_PAGE, filter);
    const render = (page: Page<GuildAuditLogSchema>) => ({
      embeds: [
        baseEmbed(commandName)
          .setTitle("📜 Audit Log")
          .setDescription(page.rows.map(describeEntry).join("\n") || "No changes recorded."),
      ],
    });
    const firstPage = await fetchPage(1);
    const pager = createPager({
      namespace: "audit-log",
      userId: ctx.user.id,
      page: firstPage,
      fetchPage,
      render,
    });
    const response = await ctx.reply(await pager.payload(firstPage));
    pager.attach(response);
    return response;
  }
}

function describeEntry(entry: GuildAuditLogSchema): string {
  const actor = entry.actorId ? `<@${entry.actorId}>` : "the bot";
  const when = `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`;
  const change = AUDIT_KINDS[entry.kind]?.describe(entry) ?? `\`${entry.key}\` changed`;
  return `**#${entry.id}** ${when} ${actor}\n${change}`;
}
