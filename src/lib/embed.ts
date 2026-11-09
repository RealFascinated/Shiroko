import { EmbedBuilder, MessageFlags, type InteractionReplyOptions } from "discord.js";
import { Constants } from "../constants";
import { discordClient } from "../client";
import type { Page } from "./pagination";

/**
 * Base constructors for every embed. See `DESIGN.md` for the full system.
 *
 * Embeds are "result cards": a summary line (layer 1) carries the news,
 * optional details (layer 2) carries supporting numbers, and optional flavor
 * (layer 3) carries personality. Always italic, always last.
 *
 * Every embed wears the same footer: bot name, then the invoking command.
 */
export function baseEmbed(command: string | null = null, page?: Page<unknown>): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Constants.mainColor)
    .setFooter({ text: page ? `${footerText(command)} · ${pageSummary(page)}` : footerText(command) });
}

/**
 * The `Page 1/3 · 24 Items` counter a paged list wears in its footer.
 */
export function pageSummary({ page, pageCount, total }: Page<unknown>): string {
  return `Page ${page}/${pageCount} ·${total} ${total === 1 ? "Item" : "Items"}`;
}

/**
 * Red-tinted variant for errors, failed actions, and locked-out cooldowns.
 * Same shape rules as {@link baseEmbed}.
 */
export function errorEmbed(command: string | null = null): EmbedBuilder {
  return new EmbedBuilder().setColor(Constants.errorColor).setFooter({ text: footerText(command) });
}

/**
 * Reply options for an ephemeral error: visible only to the invoking user.
 * Success cards remain public; see DESIGN.md.
 *
 * Build the embed first, then pass it: `ctx.reply(ephemeralErrorReply(command, embed))`.
 */
export function ephemeralErrorReply(command: string | null, embed: EmbedBuilder): InteractionReplyOptions {
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

export function footerText(command: string | null = null): string {
  const botName = discordClient.user?.displayName;
  return command ? `${botName} · /${command}` : `${botName}`;
}
