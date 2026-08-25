import { EmbedBuilder, type ButtonInteraction, type InteractionResponse } from "discord.js";
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

/**
 * Options for {@link watchButtonPress}.
 */
export interface WatchButtonOptions {
  /**
   * Which custom id to accept. Presses of any other button are ignored.
   */
  customId: string;
  /**
   * Discord user id allowed to press the button. Any other presser is ignored.
   */
  userId: string;
  /**
   * How long the button stays clickable, in milliseconds. When the window
   * passes (or the button is used), the components are cleared from the reply.
   */
  windowMs: number;
  /**
   * What to do on a valid press. The button is removed first, then this
   * callback runs (typically a follow-up).
   */
  onPress(button: ButtonInteraction): Promise<void>;
}

/**
 * Watch a reply for a press of one button by one specific user, then hand the
 * interaction to `onPress`.
 *
 * This is the generic shape behind "… back!" buttons and other one-shot
 * confirmations: only `options.userId` may press, presses of other buttons
 * are ignored, the components are stripped the moment a valid press lands
 * (so it can't be used twice), and they're stripped again when `windowMs`
 * elapses so the message doesn't keep dead buttons around.
 *
 * @param response - The reply to watch, e.g. from `ctx.reply({ ..., components })`.
 * @param options - Which button to accept and what to do on a valid press.
 */
export async function watchButtonPress(
  response: InteractionResponse,
  options: WatchButtonOptions
): Promise<void> {
  const collector = response.createMessageComponentCollector({ time: options.windowMs });

  collector.on("collect", async (button: ButtonInteraction) => {
    if (button.customId !== options.customId || button.user.id !== options.userId) {
      return;
    }
    await button.update({ components: [] });
    await options.onPress(button);
  });

  collector.on("end", async () => {
    await response.edit({ components: [] });
  });
}
