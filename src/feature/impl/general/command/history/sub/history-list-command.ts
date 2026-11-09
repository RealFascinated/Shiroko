import Command, { type ExecuteContext } from "@/command/command";
import { stringOption, type CommandOptionBuilder } from "@/command/option";
import type { HistoryEntry } from "@/history/history-kind";
import { GUILD_KIND_BY_ID, USER_KIND_BY_ID, type HistoryGroup } from "@/history/kinds";
import { baseEmbed } from "@/lib/embed";
import { createPager, type Page } from "@/lib/pagination";

const ENTRIES_PER_PAGE = 8;

export interface HistorySource {
  title: string;
  fetchPage(page: number, pageSize: number, kinds?: readonly string[]): Promise<Page<HistoryEntry>>;
}

/**
 * A paged, newest-first list of recorded history. Subclasses choose what is
 * listed and which kinds can filter it; the paging and layout are shared.
 */
export default abstract class HistoryListCommand extends Command {
  /** Groups offered in the `type` option, in display order. */
  protected abstract readonly groups: readonly HistoryGroup[];

  protected abstract source(context: ExecuteContext): HistorySource;

  protected userOptions(): CommandOptionBuilder[] {
    return [];
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      ...this.userOptions(),
      stringOption(false, "type", "Only changes to this", {
        choices: Object.fromEntries(this.groups.map(group => [group.id, group.label])),
      }),
    ];
  }

  protected override async onExecuteSlash(context: ExecuteContext) {
    const { ctx, args, commandName } = context;
    const type = args.string("type");
    const kinds = this.groups.find(group => group.id === type)?.kindIds;
    const { title, fetchPage: fetch } = this.source(context);
    const fetchPage = (page: number) => fetch(page, ENTRIES_PER_PAGE, kinds);
    const render = async (page: Page<HistoryEntry>) => {
      const entries = await Promise.all(
        page.rows.map(
          async row =>
            (await (USER_KIND_BY_ID[row.kind] ?? GUILD_KIND_BY_ID[row.kind])?.describe(row)) ??
            `\`${row.kind}\``
        )
      );
      return {
        embeds: [
          baseEmbed(commandName, page)
            .setTitle(title)
            .setDescription(entries.join("\n\n") || "Nothing recorded yet."),
        ],
      };
    };
    const firstPage = await fetchPage(1);
    const pager = createPager({
      namespace: `history-${commandName}`,
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
