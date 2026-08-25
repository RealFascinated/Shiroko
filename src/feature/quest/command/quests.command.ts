import Command, { type ExecuteContext } from "../../../command/command";
import { baseEmbed, runes } from "../../../lib/embed";
import { progressBar } from "../../../lib/utils";
import { buildQuestState, questsService, type PlayerQuest } from "../quests.service";

/**
 * Show your current daily and weekly quests. Completed quests are claimed
 * with the "Claim All" button. Quests roll a fresh random list every period.
 */
export default class QuestsCommand extends Command {
  constructor() {
    super("quests", "View and claim your daily and weekly quests");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ globalUser, ctx, commandName }: ExecuteContext) {
    const lists = await questsService.getQuests(globalUser.id);
    const daily = lists[0] ?? [];
    const weekly = lists[1] ?? [];
    const state = buildQuestState();

    const embed = baseEmbed(commandName)
      .setTitle("📜 Quests")
      .setDescription(
        `Complete quests to earn runes. New daily quests arrive every day at midnight UTC, new weekly quests every Monday.\n` +
          `**Daily** - until <t:${Math.floor(state.daily.end.getTime() / 1000)}:t>\n` +
          `**Weekly** - until <t:${Math.floor(state.weekly.end.getTime() / 1000)}:t>`
      );

    embed.addFields(
      { name: "🌅 Daily", value: this.renderList(daily), inline: false },
      { name: "🗓️ Weekly", value: this.renderList(weekly), inline: false }
    );

    return ctx.reply({ embeds: [embed] });
  }

  /** Render one quest panel: one line per quest with progress and state. */
  private renderList(quests: PlayerQuest[]): string {
    if (!quests.length) {
      return "No quests yet";
    }
    return quests.map(this.renderQuest).join("\n");
  }

  /** Render a single quest line. */
  private renderQuest(quest: PlayerQuest): string {
    const { definition, progress, claimed } = quest;
    const state = claimed ? "✅" : progress >= definition.target ? "🔓" : "⏳";
    const bar = progressBar(progress, definition.target);
    return `${state} ${definition.emoji} **${definition.text}**\n${bar} ${progress.toLocaleString()}/${definition.target.toLocaleString()} · ${runes(definition.reward)}`;
  }
}
