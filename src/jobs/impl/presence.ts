import { ActivityType, type Client } from "discord.js";
import { formatCount } from "@/lib/format";
import Job from "../job";
import { IntervalSchedule } from "../schedule";

/**
 * Keeps the bot's presence showing how many guilds it is in. Polling instead
 * of reacting to joins/leaves also recovers the presence after Discord drops
 * or resets it, and after a reconnect. `setActivity` only sets the activity,
 * leaving the status (online/idle) alone.
 */
export default class PresenceJob extends Job {
  public constructor() {
    super({ id: "presence", schedule: new IntervalSchedule(5 * 60 * 1000), runOnReady: true });
  }

  public override async run(client: Client): Promise<void> {
    client.user?.setActivity({
      name: `${formatCount(client.guilds.cache.size)} servers`,
      type: ActivityType.Watching,
    });
  }
}
