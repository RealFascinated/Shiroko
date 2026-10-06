import { openDmChannel } from "@/lib/dm";
import { baseEmbed } from "@/lib/embed";
import { discordTimestamp } from "@/lib/time";
import type { Client, SendableChannels } from "discord.js";
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
 * Send one claimed reminder to its stored target, falling back to the
 * owner's DMs when that target is gone.
 *
 * The row is already claimed, so this never retries: if neither the target
 * nor a DM can be reached, the reminder is logged and dropped. `fetch`
 * rejects for a channel that no longer exists rather than returning null,
 * so the rejection is folded into the same "unreachable" path as a channel
 * that exists but cannot be posted to.
 */
async function deliver(client: Client, reminder: Reminder): Promise<void> {
  const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
  if (channel?.isSendable()) {
    // A channel reminder pings its owner; a DM is already addressed to them.
    await sendReminder(channel, reminder, reminder.dm ? undefined : `<@${reminder.userId}>`);
    return;
  }

  const user = await client.users.fetch(reminder.userId).catch(() => null);
  const dm = user ? await openDmChannel(user) : null;
  if (!dm) {
    console.warn(
      `Reminder #${reminder.id}: target ${reminder.channelId} is unreachable and no DM could be opened; dropping it.`
    );
    return;
  }
  // A DM reminder whose channel is gone is simply re-opened, so the note is
  // only for a channel reminder that had to relocate.
  const note = reminder.dm ? undefined : "*(That channel is gone, so I sent this here instead.)*";
  await sendReminder(dm, reminder, undefined, note);
}

/**
 * Post the reminder card. `note` is appended to the text, used to explain a
 * relocated delivery.
 */
async function sendReminder(
  channel: SendableChannels,
  reminder: Reminder,
  content?: string,
  note?: string
): Promise<void> {
  const embed = baseEmbed("reminder")
    .setTitle("⏰ Reminder")
    .setDescription(note ? `${reminder.about}\n\n${note}` : reminder.about)
    .addFields({ name: "Set", value: discordTimestamp(reminder.createdAt) });
  await channel.send({ content, embeds: [embed] });
}
