import { TimeUnit } from "@/lib/time";
import type { Client } from "discord.js";
import Components from "./components";

// Older rows are history from before this sweep existed; editing thousands of
// stale messages at once would only burn rate limit.
const STRIP_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Day, 1);

/**
 * Delete expired component rows, then strip the buttons off the messages
 * whose rows just expired so a dead button is not left clickable. Stripping
 * is best-effort: the rows are already gone, so a missing channel or message
 * only logs.
 *
 * Never rejects, for the same `Bun.cron` reason as the birthday sweep.
 */
export async function runComponentSweep(client: Client): Promise<void> {
  try {
    const cutoff = Date.now() - STRIP_WINDOW_MS;
    const messages = new Map<string, string>();
    for (const row of await Components.deleteExpired()) {
      if (row.channelId && row.expiresAt && row.expiresAt.getTime() >= cutoff) {
        messages.set(row.messageId, row.channelId);
      }
    }
    for (const [messageId, channelId] of messages) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel?.isTextBased()) {
          await (await channel.messages.fetch(messageId)).edit({ components: [] });
        }
      } catch (error) {
        console.error(`Failed to strip expired components from message ${messageId}:`, error);
      }
    }
  } catch (error) {
    console.error("Component sweep failed:", error);
  }
}
