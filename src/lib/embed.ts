import { EmbedBuilder } from "discord.js";
import { discordClient } from "..";
import { Constants } from "../constants";

/**
 * Base constructors for every embed. See `DESIGN.md` for the full system.
 *
 * Embeds are "result cards": a summary line (layer 1) carries the news,
 * optional details (layer 2) carries supporting numbers, and optional flavor
 * (layer 3) carries personality — always italic, always last.
 *
 * Every embed wears the same footer: bot name, then the invoking command.
 */
export function baseEmbed(command: string | null = null): EmbedBuilder {
  return new EmbedBuilder().setColor(Constants.mainColor).setFooter({ text: footerText(command) });
}

/**
 * Red-tinted variant for errors, failed actions, and locked-out cooldowns.
 * Same shape rules as {@link baseEmbed}.
 */
export function errorEmbed(command: string | null = null): EmbedBuilder {
  return new EmbedBuilder().setColor(Constants.errorColor).setFooter({ text: footerText(command) });
}

/**
 * Compose the shared footer: bot name, then `/command` when known.
 */
export function footerText(command: string | null = null): string {
  const botName = discordClient.user?.displayName;
  return command ? `${botName} · /${command}` : `${botName}`;
}

/**
 * Format a rune amount consistently: `1,234 runes`.
 */
export function runes(amount: number): string {
  return `\`${amount.toLocaleString("en-US")} runes\``;
}
