import Command, { type ExecuteContext } from "../../../../../command/command";
import { channelOption, stringOption, type CommandOptionBuilder } from "../../../../../command/option";
import { baseEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./view.command";

const ACTION_CHOICES: Record<string, string> = {
  add: "Add to the ignored list",
  remove: "Remove from the ignored list",
};

/**
 * Add or remove channels from the ignored list. Messages in an ignored
 * channel never grant XP; useful for bot-spam and off-topic channels.
 */
export default class IgnoredChannelsCommand extends Command {
  constructor() {
    super("ignored-channels", "Add or remove XP-ignored channels");
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      stringOption(true, "action", "Add or remove the channel", { choices: ACTION_CHOICES }),
      channelOption(true, "channel", "Channel to add or remove"),
    ];
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const action = ctx.options.getString("action", true)!;
    const channel = ctx.options.getChannel("channel", true)!;

    const current = await levelsService.getConfig(guild.id);
    const ignored = new Set(current.ignoredChannelIds);
    if (action === "remove") {
      ignored.delete(channel.id);
    } else {
      ignored.add(channel.id);
    }
    const config = await levelsService.setConfig(guild.id, {
      ignoredChannelIds: Array.from(ignored),
    });

    const actionLabel = action === "remove" ? "removed from" : "added to";
    const embed = baseEmbed(commandName)
      .setTitle("🚫 Ignored Channels Updated")
      .setDescription(
        `<#${channel.id}> was **${actionLabel}** the XP-ignored list.\n${configSummaryLines(config).join("\n")}`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
