import { openDmChannel } from "@/lib/dm";
import { baseEmbed } from "@/lib/embed";
import { discordTimestamp } from "@/lib/time";
import type { Client, SendableChannels } from "discord.js";
import { reminderService, type Reminder } from "@/feature/impl/reminders/reminder.service";
import { ReminderLagMetric, RemindersDroppedMetric } from "@/metrics/impl/reminders";
import type { Metric } from "@/metrics/metric";
import Job from "../job";
import { IntervalSchedule } from "../schedule";

/**
 * Deliver every reminder that came due, then forget it. Kept out of
 * `reminder.service.ts` so the service stays a database layer and this
 * owns the Discord side. Each row is isolated so one bad target cannot
 * hold up the rest of the batch.
 */
export default class ReminderSweepJob extends Job {
  public readonly lag: ReminderLagMetric = new ReminderLagMetric();
  public readonly dropped: RemindersDroppedMetric = new RemindersDroppedMetric();

  public constructor() {
    super({ id: "reminder_sweep", schedule: new IntervalSchedule(30_000) });
  }

  public get metrics(): Metric<any>[] {
    return [this.lag, this.dropped];
  }

  public override async run(client: Client): Promise<void> {
    for (const reminder of await reminderService.claimDue(new Date())) {
      try {
        if (await deliver(client, reminder)) {
          this.lag.observe(Date.now() - reminder.remindAt.getTime());
        } else {
          this.dropped.increment();
        }
      } catch (error) {
        this.dropped.increment();
        console.error(`Failed to deliver reminder #${reminder.id}:`, error);
      }
    }
  }
}

/**
 * Send one claimed reminder to its stored target, falling back to the
 * owner's DMs when that target is gone or cannot be posted to.
 *
 * The row is already claimed, so this never retries: if neither the target
 * nor a DM can be reached, the reminder is logged and dropped. `fetch`
 * rejects for a channel that no longer exists rather than returning null,
 * and `send` rejects for one the bot lacks permission in, so both fold into
 * the same "unreachable" path. Resolves `false` when the reminder was dropped.
 */
async function deliver(client: Client, reminder: Reminder): Promise<boolean> {
  const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
  if (channel?.isSendable()) {
    try {
      // A channel reminder pings its owner; a DM is already addressed to them.
      await sendReminder(channel, reminder, reminder.dm ? undefined : `<@${reminder.userId}>`);
      return true;
    } catch (error) {
      console.warn(`Reminder #${reminder.id}: could not post in ${reminder.channelId}:`, error);
    }
  }

  const user = await client.users.fetch(reminder.userId).catch(() => null);
  const dm = user ? await openDmChannel(user) : null;
  if (!dm) {
    console.warn(
      `Reminder #${reminder.id}: target ${reminder.channelId} is unreachable and no DM could be opened; dropping it.`
    );
    return false;
  }
  // A DM reminder whose channel is gone is simply re-opened, so the note is
  // only for a channel reminder that had to relocate.
  const note = reminder.dm ? undefined : "*(I couldn't post in that channel, so I sent this here instead.)*";
  await sendReminder(dm, reminder, undefined, note);
  return true;
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
