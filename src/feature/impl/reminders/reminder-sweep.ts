import { baseEmbed } from "@/lib/embed";
import { discordTimestamp } from "@/lib/time";
import type { Client } from "discord.js";
import { reminderService, type Reminder } from "./reminder.service";

/**
 * Deliver every reminder that came due, then forget it. Kept out of
 * `reminder.service.ts` because it builds embeds: `lib/embed.ts` imports
 * `discordClient` from `src/index.ts`, and a module on `src/index.ts`'s
 * static import chain pulling in `embed` re-enters that graph
 * mid-initialization. `birthday-sweep.ts` is split the same way.
 *
 * Never rejects. A rejected promise out of a `setInterval` callback is an
 * `unhandledRejection`, which this process has no handler for, so the claim
 * is guarded and each row is isolated.
 */
export async function runReminderSweep(client: Client, now: Date = new Date()): Promise<void> {
  let due: Reminder[];
  try {
    due = await reminderService.claimDue(now);
  } catch (error) {
    console.error("Reminder sweep failed to claim due reminders:", error);
    return;
  }
  for (const reminder of due) {
    try {
      await deliver(client, reminder);
    } catch (error) {
      console.error(`Failed to deliver reminder #${reminder.id}:`, error);
    }
  }
}

/**
 * Send one claimed reminder to its stored target. The row is already gone,
 * so an unreachable target (deleted channel, revoked access, closed DMs)
 * is logged and dropped rather than retried.
 */
async function deliver(client: Client, reminder: Reminder): Promise<void> {
  const channel = await client.channels.fetch(reminder.channelId);
  if (!channel?.isSendable()) {
    console.warn(`Reminder #${reminder.id} target ${reminder.channelId} is not sendable; dropping it.`);
    return;
  }
  const embed = baseEmbed("reminder")
    .setTitle("⏰ Reminder")
    .setDescription(reminder.about)
    .addFields({ name: "Set", value: discordTimestamp(reminder.createdAt) });
  await channel.send({
    // A channel reminder pings its owner; a DM is already addressed to them.
    content: reminder.dm ? undefined : `<@${reminder.userId}>`,
    embeds: [embed],
  });
}
