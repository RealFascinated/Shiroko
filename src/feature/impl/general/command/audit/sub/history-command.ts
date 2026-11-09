import Command, { type ExecuteContext } from "@/command/command";
import { stringOption, type CommandOptionBuilder } from "@/command/option";
import type { HistoryEntry } from "@/history/history-kind";
import { GUILD_KIND_BY_ID, USER_KIND_BY_ID } from "@/history/kinds";
import { baseEmbed } from "@/lib/embed";
import { createPager, type Page } from "@/lib/pagination";

const ENTRIES_PER_PAGE = 8;

export interface HistorySource {
  title: string;
  fetchPage(page: number, pageSize: number, kind?: string): Promise<Page<HistoryEntry>>;
}

/**
 * A paged, newest-first list of recorded history. Subclasses choose what is
 * listed and which kinds can filter it; the paging and layout are shared.
 */
export default abstract class HistoryCommand extends Command {
  /** Kinds offered in the `type` option, in display order. */
  protected abstract readonly kinds: readonly { id: string; label: string }[];

  protected abstract source(context: ExecuteContext): HistorySource;

  protected userOptions(): CommandOptionBuilder[] {
    return [];
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      ...this.userOptions(),
      stringOption(false, "type", "Only this kind of change", {
        choices: Object.fromEntries(this.kinds.map(kind => [kind.id, kind.label])),
      }),
    ];
  }

  protected override async onExecuteSlash(context: ExecuteContext) {
    const { ctx, args, commandName } = context;
    const kind = args.string("type") ?? undefined;
    const { title, fetchPage: fetch } = this.source(context);
    const fetchPage = (page: number) => fetch(page, ENTRIES_PER_PAGE, kind);
    const render = (page: Page<HistoryEntry>) => ({
      embeds: [
        baseEmbed(commandName)
          .setTitle(title)
          .setDescription(
            page.rows
              .map(row => {
                const when = `<t:${Math.floor(row.createdAt.getTime() / 1000)}:R>`;
                const by = row.actorId ? ` by <@${row.actorId}>` : "";
                const described = (USER_KIND_BY_ID[row.kind] ?? GUILD_KIND_BY_ID[row.kind])?.describe(row);
                return `${when} ${described ?? `\`${row.kind}\``}${by}`;
              })
              .join("\n") || "Nothing recorded yet."
          ),
      ],
    });
    const firstPage = await fetchPage(1);
    const pager = createPager({
      namespace: `audit-${commandName}`,
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
