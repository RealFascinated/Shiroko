import Command, { type ExecuteContext } from "@/command/command";
import { booleanOption, stringOption } from "@/command/option";
import { reminderService } from "@/feature/impl/reminders/reminder.service";
import { openDmChannel } from "@/lib/dm";
import { baseEmbed, errorEmbed } from "@/lib/embed";
import { discordTimestamp, parseDuration, TimeUnit } from "@/lib/time";

const MIN_DURATION_MS = TimeUnit.toMillis(TimeUnit.Minute, 1);
const MAX_DURATION_MS = TimeUnit.toMillis(TimeUnit.Month, 3);

/**
 * Bounded so a full page of reminders fits one embed: `/reminder list`
 * renders `REMINDER_PAGE_SIZE` rows, and Discord caps an embed description
 * at 4096 characters.
 */
const MAX_ABOUT_LENGTH = 300;

/**
 * Schedule a reminder for yourself. `about` and `time` are required; `dm` is
 * an override that only ever moves a guild reminder into the DMs, because a
 * reminder set in a DM is already a DM.
 */
export default class SetCommand extends Command {
  constructor() {
    super({ id: "set", displayName: "Schedule a reminder" });
  }

  public override get options() {
    return [
      stringOption(true, "about", "What to remind you about"),
      stringOption(true, "time", "How long from now, e.g. 30m, 2h, 1d30m"),
      booleanOption(false, "dm", "Send it as a DM instead of in this channel"),
    ];
  }

  protected override async onExecuteSlash({ user, ctx, args, commandName }: ExecuteContext) {
    const about = ctx.options.getString("about", true);
    const durationMs = parseDuration(ctx.options.getString("time", true));

    if (durationMs === null) {
      return ctx.reply({
        embeds: [
          errorEmbed(commandName).setDescription("I could not read that time. Try `30m`, `2h`, or `1d30m`."),
        ],
      });
    }
    if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
      return ctx.reply({
        embeds: [
          errorEmbed(commandName).setDescription("Pick a time between 1 minute and 3 months from now."),
        ],
      });
    }
    if (about.length > MAX_ABOUT_LENGTH) {
      return ctx.reply({
        embeds: [
          errorEmbed(commandName).setDescription(`Keep the reminder under ${MAX_ABOUT_LENGTH} characters.`),
        ],
      });
    }

    // In a DM the target is this DM whatever the option says: there is no
    // other channel to post into, and recording `dm: false` would make
    // `/reminder list` describe the destination wrongly.
    const inDm = ctx.channel?.isDMBased() ?? false;
    const dm = inDm || (args.boolean("dm") ?? false);
    const channelId = !inDm && dm ? (await openDmChannel(user.discordUser))?.id : ctx.channelId;
    if (!channelId) {
      return ctx.reply({
        embeds: [
          errorEmbed(commandName).setDescription(
            "I could not open a DM with you. Check that you accept DMs from this server, or leave `dm` off."
          ),
        ],
      });
    }

    const remindAt = new Date(Date.now() + durationMs);
    const reminder = await reminderService.create(user.id, channelId, dm, about, remindAt);

    const where = dm ? (inDm ? "here" : "in your DMs") : "in this channel";
    const embed = baseEmbed(commandName)
      .setTitle("⏰ Reminder Set")
      .setDescription(`**#${reminder.id}** · ${discordTimestamp(remindAt)} · ${where}\n${about}`);
    return ctx.reply({ embeds: [embed] });
  }
}
