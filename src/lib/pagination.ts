import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type InteractionResponse,
  type MessageActionRowComponentBuilder,
  type MessageEditOptions,
} from "discord.js";
import { TimeUnit } from "./time";

const PAGE_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Hour, 3);

/**
 * One page of a list: the rows for that page plus the totals needed to
 * render navigation. Every paginated list returns this shape, and the page
 * is chosen by the source, never by the caller slicing a full result set.
 */
export interface Page<T> {
  /** 1-based page number, clamped into range. */
  page: number;
  pageSize: number;
  /** Total pages; 1 for an empty list. */
  pageCount: number;
  /** Total rows across every page. */
  total: number;
  rows: T[];
}

/**
 * The inputs {@link loadPage} assembles a page from: a 1-based page plus
 * the total count and row fetch that select it from the source.
 */
export interface PageRequest<T> {
  /** 1-based requested page; clamped into range. */
  page: number;
  /** Rows per page; clamped to at least 1. */
  pageSize: number;
  /** Total rows across every page, ignoring paging. */
  count(): Promise<number>;
  /** At most `limit` rows starting at `offset`. */
  rows(limit: number, offset: number): Promise<T[]>;
}

/**
 * Assemble one page from a total count and a row fetch, clamping the page
 * into range before fetching so the returned page always describes the rows
 * it carries.
 *
 * Database-backed sources pass a `count()` running `COUNT(*)` and a `rows()`
 * running `LIMIT`/`OFFSET`, so the database selects the page instead of the
 * caller loading everything and slicing.
 */
export async function loadPage<T>({ page, pageSize, count, rows }: PageRequest<T>): Promise<Page<T>> {
  const size = Math.max(1, Math.floor(pageSize));
  const total = await count();
  const pageCount = Math.max(1, Math.ceil(total / size));
  const clamped = Math.min(Math.max(1, Math.floor(page)), pageCount);
  return { page: clamped, pageSize: size, pageCount, total, rows: await rows(size, (clamped - 1) * size) };
}

/**
 * Pagination options for {@link attachPager}.
 */
export interface PagerOptions<T> {
  /**
   * Unique namespace for this pager's button custom ids so multiple
   * pagers on different messages never collide.
   */
  namespace: string;
  /**
   * Only this user id may page; presses from anyone else are ignored.
   */
  userId: string;
  /**
   * The page already shown in the reply. Paging continues from it, and its
   * `pageCount` decides whether a pager is attached at all.
   */
  page: Page<T>;
  /**
   * Fetch one 1-based page when a button is pressed, e.g. a `LIMIT`/`OFFSET`
   * query or a leaderboard's `getPage`.
   */
  fetchPage(page: number): Promise<Page<T>>;
  render(page: Page<T>): MessageEditOptions | Promise<MessageEditOptions>;
}

/**
 * Wrap a reply in a prev/next pager.
 *
 * The reply has already rendered `options.page`; this attaches the ⏮ ◀ ▶ ⏭
 * buttons and re-renders via `options.fetchPage` on each valid press. Only
 * `options.userId` may page. The nav bar disables at the ends and is
 * stripped when the window elapses. No-op when the list has a single page.
 */
export async function attachPager<T>(response: InteractionResponse, options: PagerOptions<T>): Promise<void> {
  const { namespace, userId, page: initialPage, fetchPage, render } = options;
  const pageCount = initialPage.pageCount;
  if (pageCount <= 1) {
    return;
  }
  const ids = {
    first: `${namespace}-first`,
    prev: `${namespace}-prev`,
    next: `${namespace}-next`,
    last: `${namespace}-last`,
    counter: `${namespace}-counter`,
  };
  let page = initialPage;

  const pageRow = () =>
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.first)
        .setLabel("⏮")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page.page <= 1),
      new ButtonBuilder()
        .setCustomId(ids.prev)
        .setLabel("◀")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page.page <= 1),
      new ButtonBuilder()
        .setCustomId(ids.counter)
        .setLabel(`${page.page} / ${pageCount}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(ids.next)
        .setLabel("▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page.page >= pageCount),
      new ButtonBuilder()
        .setCustomId(ids.last)
        .setLabel("⏭")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page.page >= pageCount)
    );

  const draw = async () => response.edit({ ...(await render(page)), components: [pageRow()] });

  await draw();

  const collector = response.createMessageComponentCollector({ time: PAGE_WINDOW_MS });
  collector.on("collect", async (button: ButtonInteraction) => {
    if (button.user.id !== userId) {
      return;
    }
    let target = page.page;
    switch (button.customId) {
      case ids.first:
        target = 1;
        break;
      case ids.prev:
        target = page.page - 1;
        break;
      case ids.next:
        target = page.page + 1;
        break;
      case ids.last:
        target = pageCount;
        break;
    }
    if (target === page.page || target < 1 || target > pageCount) {
      return;
    }
    page = await fetchPage(target);
    await button.update({ ...(await render(page)), components: [pageRow()] });
  });
  collector.on("end", async () => {
    await response.edit({ components: [] });
  });
}
