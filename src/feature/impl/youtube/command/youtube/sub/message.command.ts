import Command, { type ExecuteContext } from "@/command/command";
import { stringOption, type CommandOptionBuilder } from "@/command/option";
import { youtubePlaceholders } from "@/feature/impl/youtube/youtube-placeholders";
import { youtubeSettings } from "@/feature/impl/youtube/youtube-settings";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { PermissionFlags } from "@/permission/permissions";

/** Sample values so the confirmation shows what the template produces. */
const PREVIEW = {
  channelName: "Channel Name",
  videoTitle: "Video Title",
  videoLink: "https://www.youtube.com/watch?v=xxxxxxxxxxx",
};

export default class MessageCommand extends Command {
  constructor() {
    super("message", "Set the message sent when a tracked channel uploads");
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.YOUTUBE_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [stringOption(true, "message", `Use ${describeTokens()}`)];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const message = ctx.options.getString("message", true);
    // The engine's own parse/has: tokens it does not know are typos, and
    // saving one would render it verbatim.
    const unknown = youtubePlaceholders.parse(message).filter(token => !youtubePlaceholders.has(token));
    if (unknown.length > 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map(token => `\`{${token}}\``).join(", ")}.`
          )
        )
      );
    }

    await youtubeSettings.set(guild.id, "message", message);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("📺 Announcement Message Set")
          .setDescription(
            `\`\`\`\n${message}\n\`\`\`\n**Preview**\n${await youtubePlaceholders.replace(PREVIEW, message)}`
          ),
      ],
    });
  }
}

/** The `{token}` list for the option description, straight from the registry. */
function describeTokens(): string {
  return youtubePlaceholders.placeholders.map(placeholder => `{${placeholder.key}}`).join(", ");
}
