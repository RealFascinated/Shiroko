import Command, { type ExecuteContext } from "@/command/command";
import { baseEmbed } from "@/lib/embed";

interface VoteSite {
  readonly name: string;
  readonly url: string;
}

const VOTE_SITES: readonly VoteSite[] = [
  { name: "top.gg", url: "https://top.gg/bot/879163534871789619/vote" },
  { name: "discordbotlist.com", url: "https://discordbotlist.com/bots/arona/upvote" },
  { name: "topbot.gg", url: "https://topbot.gg/en/bots/arona" },
];

export default class VoteCommand extends Command {
  constructor() {
    super({ id: "vote", displayName: "Links to vote for the bot on listing sites" });
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const embed = baseEmbed(commandName)
      .setTitle("🗳️ Vote for Arona")
      .setDescription(
        [
          "Voting helps more people discover the bot. You can vote on each site once every 12 hours:",
          "",
          ...VOTE_SITES.map(site => `**➜** [${site.name}](${site.url})`),
        ].join("\n")
      );

    return ctx.reply({ embeds: [embed] });
  }
}
