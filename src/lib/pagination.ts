import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type BaseMessageOptions,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type MessageActionRowComponentBuilder,
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
   * The page to show: its `pageCount` decides whether a nav bar renders.
   */
  page: Page<T>;
  /**
   * Fetch one 1-based page when a button is pressed, e.g. a `LIMIT`/`OFFSET`
   * query or a leaderboard's `getPage`.
   */
  fetchPage(page: number): Promise<Page<T>>;
  render(page: Page<T>): PagePayload | Promise<PagePayload>;
}

/**
 * Payload type accepted identically by the reply, edit, and update
 * overloads: discord.js specialises `flags` and `content` per overload,
 * and a pager sets neither.
 */
export type PagePayload = BaseMessageOptions;

/**
 * A prev/next pager: the payload to reply with, and the collector that
 * drives it. The nav bar is part of {@link Pager.payload}, so the initial
 * reply carries working buttons and the message is never edited until the
 * window elapses and the dead nav bar is stripped.
 */
export interface Pager<T> {
  payload(page: Page<T>): Promise<PagePayload>;
  attach(response: InteractionResponse): void;
}

/**
 * Build a pager around a page source. Reply with
 * `payload(options.page)`, then hand the sent response to `attach`.
 * Valid presses re-render via `options.fetchPage` through `button.update`
 * (which leaves no "edited" marker). Only `options.userId` may page. The
 * nav bar disables at the ends. No-op when the list has a single page.
 */
function createPager<T>(options: PagerOptions<T>): Pager<T> {
  const { namespace, userId, page: initialPage, fetchPage, render } = options;
  const pageCount = initialPage.pageCount;
  const ids = {
    first: `${namespace}-first`,
    prev: `${namespace}-prev`,
    next: `${namespace}-next`,
    last: `${namespace}-last`,
    counter: `${namespace}-counter`,
  };
  const pageRow = (page: Page<T>) =>
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
  const payload = async (page: Page<T>): Promise<PagePayload> => {
    const body: PagePayload = await render(page);
    return pageCount <= 1 ? body : { ...body, components: [pageRow(page)] };
  };
  let current = initialPage;
  const attach = (response: InteractionResponse): void => {
    if (pageCount <= 1) {
      return;
    }
    const collector = response.createMessageComponentCollector({ time: PAGE_WINDOW_MS });
    collector.on("collect", async (button: ButtonInteraction) => {
      if (button.user.id !== userId) {
        await button
          .reply({
            content: "Only the person who ran this command can turn its pages.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => undefined);
        return;
      }
      let target = current.page;
      switch (button.customId) {
        case ids.first:
          target = 1;
          break;
        case ids.prev:
          target = current.page - 1;
          break;
        case ids.next:
          target = current.page + 1;
          break;
        case ids.last:
          target = pageCount;
          break;
      }
      if (target === current.page || target < 1 || target > pageCount) {
        return;
      }
      try {
        current = await fetchPage(target);
        await button.update(await payload(current));
      } catch (error) {
        console.error(`Failed to turn page for pager "${namespace}":`, error);
      }
    });
    collector.on("end", async () => {
      // The reply's interaction token lives 15 minutes, shorter than the
      // collector window, so this edit usually fails; the nav bar then simply stays.
      await response.edit({ components: [] }).catch(() => undefined);
    });
  };
  return { payload, attach };
}

export interface PagedReplyOptions<T> {
  /** Unique namespace for the nav bar's button custom ids. */
  namespace: string;
  fetchPage(page: number): Promise<Page<T>>;
  render(page: Page<T>): PagePayload | Promise<PagePayload>;
  /** Sent instead of the list when it has no rows; omit for lists that are never empty. */
  empty?: PagePayload;
}

/**
 * The one way a command replies with a paged list, so every list shares the
 * same empty state, nav bar, and footer: fetch page 1, send `empty` when it
 * has no rows, otherwise reply with the page and attach the pager.
 */
export async function replyPaged<T>(
  ctx: ChatInputCommandInteraction,
  options: PagedReplyOptions<T>
): Promise<InteractionResponse> {
  const page = await options.fetchPage(1);
  if (options.empty && page.rows.length === 0) {
    return ctx.reply(options.empty);
  }
  const pager = createPager({ ...options, userId: ctx.user.id, page });
  const response = await ctx.reply(await pager.payload(page));
  pager.attach(response);
  return response;
}
