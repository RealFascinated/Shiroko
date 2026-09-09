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
 * Pagination options for {@link attachPager}.
 */
export interface PagerOptions {
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
   * Total number of pages. A single page is not paginated.
   */
  pageCount: number;
  /**
   * Build the content for the given 1-indexed page.
   */
  render(page: number): MessageEditOptions;
}

/**
 * Wrap a reply in a prev/next pager.
 *
 * Renders page 1, then watches presses of the ⏮ ◀ ▶ ⏭ buttons; any valid
 * press from `options.userId` re-renders via `options.render`. The nav bar is
 * disabled at the ends and stripped entirely when the window elapses. No-op
 * for a single page (the caller should reply with the page directly).
 */
export async function attachPager(response: InteractionResponse, options: PagerOptions): Promise<void> {
  const { namespace, userId, pageCount, render } = options;
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
  let page = 1;

  const pageRow = () =>
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.first)
        .setLabel("⏮")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(ids.prev)
        .setLabel("◀")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(ids.counter)
        .setLabel(`${page} / ${pageCount}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(ids.next)
        .setLabel("▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pageCount),
      new ButtonBuilder()
        .setCustomId(ids.last)
        .setLabel("⏭")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pageCount)
    );

  const draw = () => response.edit({ ...render(page), components: [pageRow()] });

  await draw();

  const collector = response.createMessageComponentCollector({ time: PAGE_WINDOW_MS });
  collector.on("collect", async (button: ButtonInteraction) => {
    if (button.user.id !== userId) {
      return;
    }
    let target = page;
    switch (button.customId) {
      case ids.first:
        target = 1;
        break;
      case ids.prev:
        target = page - 1;
        break;
      case ids.next:
        target = page + 1;
        break;
      case ids.last:
        target = pageCount;
        break;
    }
    if (target === page || target < 1 || target > pageCount) {
      return;
    }
    page = target;
    await button.update({ ...render(page), components: [pageRow()] });
  });
  collector.on("end", async () => {
    await response.edit({ components: [] });
  });
}
