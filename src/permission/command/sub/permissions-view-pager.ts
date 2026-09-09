import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type EmbedBuilder,
  type InteractionResponse,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { TimeUnit } from "../../../lib/time";

/** Custom button ids emitted by this pager, namespaced so they can't collide. */
const PAGE_FIRST = "perm-view-first";
const PAGE_PREV = "perm-view-prev";
const PAGE_NEXT = "perm-view-next";
const PAGE_LAST = "perm-view-last";
const PAGE_COUNTER = "perm-view-counter";

const PAGE_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Hour, 3);

/**
 * Build a standard prev/next page-nav action row. Pages are 1-indexed;
 * `page` is 1..pageCount. Disabled states reflect position.
 */
function pageRow(page: number, pageCount: number): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PAGE_FIRST)
      .setLabel("⏮")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(PAGE_PREV)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(PAGE_COUNTER)
      .setLabel(`${page} / ${pageCount}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(PAGE_NEXT)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pageCount),
    new ButtonBuilder()
      .setCustomId(PAGE_LAST)
      .setLabel("⏭")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pageCount)
  );
}

/**
 * Wrap a reply in a prev/next pager.
 *
 * `pageCount` is the total number of pages; `render(page)` returns the embed
 * for the 1-indexed page. Only `userId` may page; the buttons disable at the
 * ends and are stripped when the window elapses. No-op for a single page.
 *
 * @param response - The live reply to attach the pager to (an `InteractionResponse`).
 * @param userId - Only this user may page.
 * @param pageCount - Total pages.
 * @param render - Build the page embed for the given 1-indexed page.
 */
export async function attachPager(
  response: InteractionResponse,
  userId: string,
  pageCount: number,
  render: (page: number) => EmbedBuilder
): Promise<void> {
  if (pageCount <= 1) {
    return;
  }
  let page = 1;
  await response.edit({ embeds: [render(page)], components: [pageRow(page, pageCount)] });

  const collector = response.createMessageComponentCollector({ time: PAGE_WINDOW_MS });
  collector.on("collect", async (button: ButtonInteraction) => {
    if (button.user.id !== userId) {
      return;
    }
    const target =
      button.customId === PAGE_FIRST
        ? 1
        : button.customId === PAGE_PREV
          ? page - 1
          : button.customId === PAGE_NEXT
            ? page + 1
            : button.customId === PAGE_LAST
              ? pageCount
              : page;
    if (target === page || target < 1 || target > pageCount) {
      return;
    }
    page = target;
    await button.update({ embeds: [render(page)], components: [pageRow(page, pageCount)] });
  });
  collector.on("end", async () => {
    await response.edit({ components: [] });
  });
}
