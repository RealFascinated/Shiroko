import Command, { type ExecuteContext } from "@/command/command";
import { youtubeSettings } from "@/feature/impl/youtube/youtube-settings";
import { YoutubeService, type TrackedChannelView } from "@/feature/impl/youtube/youtube.service";
import { baseEmbed } from "@/lib/embed";
import { attachPager, type Page } from "@/lib/pagination";

/** Discord's embed field cap; a long template is clipped rather than rejected. */
const MAX_FIELD = 1024;

/** Unique pager namespace so its button custom ids cannot collide. */
const PAGER_NAMESPACE = "youtube-show";

export default class ShowCommand extends Command {
  constructor() {
    super("show", "Show this server's YouTube settings");
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const message = await youtubeSettings.get(guild.id, "message");

    const render = (page: Page<TrackedChannelView>) => {
      const description =
        page.total === 0 ? "This server isn't tracking any channels yet." : renderChannels(page);
      return {
        embeds: [
          baseEmbed(commandName)
            .setTitle("📺 YouTube")
            .addFields({
              name: "Announcement message",
              value: `\`\`\`\n${clip(message, MAX_FIELD - 8)}\n\`\`\``,
            })
            .setDescription(description),
        ],
      };
    };

    const firstPage = await YoutubeService.pageForGuild(guild.id, 1);
    const response = await ctx.reply(render(firstPage));
    await attachPager(response, {
      namespace: PAGER_NAMESPACE,
      userId: ctx.user.id,
      page: firstPage,
      fetchPage: pageNumber => YoutubeService.pageForGuild(guild.id, pageNumber),
      render,
    });
  }
}

function renderChannels(page: Page<TrackedChannelView>): string {
  const lines = page.rows.map(channel => `**${channel.displayName}** → <#${channel.discordChannelId}>`);
  return `${lines.join("\n\n")}\n\n**${page.total}** tracked`;
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
