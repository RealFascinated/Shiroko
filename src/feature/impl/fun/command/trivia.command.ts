import type { ExecuteContext } from "@/command/command";
import ComponentCommand from "@/component/component-command";
import { componentCustomId, type ComponentContext, type ComponentType } from "@/component/component";
import Components from "@/component/components";
import type { TriviaGuessSchema } from "@/db/schemas/trivia-guesses";
import { baseEmbed, errorEmbed } from "@/lib/embed";
import { titleCase } from "@/lib/format";
import { discordTimestamp, TimeUnit } from "@/lib/time";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import type { CommandOptionBuilder } from "@/command/option";
import { stringOption } from "@/command/option";
import { TRIVIA_HINT_COMPONENT_ID } from "../trivia-hint.component";
import TriviaService, {
  TRIVIA_CATEGORIES,
  type TriviaCategory,
  type TriviaDifficulty,
  type TriviaQuestion,
} from "../trivia.service";

const ANSWER_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Minute, 1);
const LABEL_LIMIT = 80;
const LISTED_GUESSES = 10;

type TriviaAnswerPayload = {
  /** The first answer button's row id, which every guess on the question references. */
  gameId: string;
  index: number;
  question: TriviaQuestion;
  commandName: string;
};

/**
 * One random trivia question with four answer buttons and, when the question
 * has one, a hint button. Every player gets one guess; the first correct
 * guess or the timeout ends the question and reveals the answer along with
 * everyone's guesses.
 */
export default class TriviaCommand extends ComponentCommand<TriviaAnswerPayload> {
  public readonly type: ComponentType = "button";

  constructor() {
    super({ id: "trivia", displayName: "Answer a random trivia question" });
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      stringOption(false, "difficulty", "Question difficulty", {
        choices: { easy: "Easy", medium: "Medium", hard: "Hard" },
      }),
      stringOption(false, "category", "Question category", { choices: TRIVIA_CATEGORIES }),
    ];
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    await ctx.deferReply();
    const difficulty = args.string("difficulty") as TriviaDifficulty | null;
    const category = args.string("category") as TriviaCategory | null;
    let question: TriviaQuestion;
    try {
      question = await TriviaService.fetchQuestion(difficulty, category);
    } catch {
      await ctx.editReply({
        embeds: [errorEmbed(commandName).setDescription("Trivia is unavailable, try again later.")],
      });
      return;
    }

    const endsAt = new Date(Date.now() + ANSWER_WINDOW_MS);
    const answerIds = question.answers.map(() => Components.newId());
    const hintId = Components.newId();
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      question.answers.map((answer, index) =>
        new ButtonBuilder()
          .setCustomId(componentCustomId(this.componentId, answerIds[index]!))
          .setLabel(answer.slice(0, LABEL_LIMIT))
          .setStyle(ButtonStyle.Secondary)
      )
    );
    if (question.hint !== null) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(componentCustomId(TRIVIA_HINT_COMPONENT_ID, hintId))
          .setLabel("Hint")
          .setEmoji("💡")
          .setStyle(ButtonStyle.Primary)
      );
    }
    const message = await ctx.editReply({
      embeds: [
        questionEmbed(commandName, question).setDescription(
          `${question.question}\n\nOne guess each. Ends ${discordTimestamp(endsAt)}.`
        ),
      ],
      components: [row],
    });

    const target = {
      guildId: ctx.guildId,
      channelId: message.channelId,
      messageId: message.id,
      userId: null,
      type: this.type,
      expiresAt: endsAt,
    };
    const gameId = answerIds[0]!;
    // Sequential so the game row exists before any sibling's press can guess against it.
    for (const [index, id] of answerIds.entries()) {
      await Components.create({ ...target, id, extraData: { gameId, index, question, commandName } });
    }
    if (question.hint !== null) {
      await Components.create({ ...target, id: hintId, extraData: { hint: question.hint } });
    }

    // In memory, so a restart loses the reveal; the component sweep still
    // strips the expired buttons. The 60s window is well inside the
    // interaction token's 15 minutes, so editing the reply works even on a
    // user install where the bot cannot see the channel.
    setTimeout(async () => {
      try {
        const guesses = await TriviaService.end(gameId, message.id);
        if (guesses !== null) {
          await ctx.editReply(revealMessage(commandName, question, guesses));
        }
      } catch (error) {
        console.error("Failed to end trivia question:", error);
      }
    }, ANSWER_WINDOW_MS);
  }

  public async handle({ payload, interaction }: ComponentContext<TriviaAnswerPayload>): Promise<void> {
    if (!interaction.isButton()) {
      return;
    }
    const { question } = payload;
    if (!(await TriviaService.guess(payload.gameId, interaction.user.id, payload.index))) {
      await interaction.reply({
        content: "You already used your guess on this question.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (payload.index !== question.correctIndex) {
      await interaction.reply({
        content: `❌ **${question.answers[payload.index]}** isn't it, and that was your one guess.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guesses = await TriviaService.end(payload.gameId, interaction.message.id);
    if (guesses === null) {
      await interaction.reply({
        content: "Too late, this question already ended.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.update(revealMessage(payload.commandName, question, guesses));
  }
}

function questionEmbed(commandName: string, question: TriviaQuestion) {
  return baseEmbed(commandName)
    .setTitle("❓ Trivia")
    .addFields(
      { name: "Category", value: question.category, inline: true },
      { name: "Difficulty", value: titleCase(question.difficulty), inline: true }
    );
}

/**
 * The ended question: who won (or that time ran out), the explanation, and
 * every wrong guess. The buttons stay as a disabled answer key, green for
 * the answer and red for the wrong answers someone picked.
 */
function revealMessage(commandName: string, question: TriviaQuestion, guesses: TriviaGuessSchema[]) {
  const answer = question.answers[question.correctIndex]!;
  const winner = guesses.find(guess => guess.answerIndex === question.correctIndex);
  const wrong = guesses.filter(guess => guess !== winner);
  const wrongLines = wrong
    .slice(0, LISTED_GUESSES)
    .map(guess => `❌ <@${guess.userId}> guessed **${question.answers[guess.answerIndex]}**`);
  if (wrong.length > LISTED_GUESSES) {
    wrongLines.push(`...and ${wrong.length - LISTED_GUESSES} more`);
  }
  const description = [
    question.question,
    winner ? `✅ <@${winner.userId}> got it: **${answer}**` : `⏰ Time's up! The answer was **${answer}**`,
    question.explanation,
    wrongLines.join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    question.answers.map((label, index) =>
      new ButtonBuilder()
        .setCustomId(`trivia-reveal:${index}`)
        .setLabel(label.slice(0, LABEL_LIMIT))
        .setDisabled(true)
        .setStyle(
          index === question.correctIndex
            ? ButtonStyle.Success
            : guesses.some(guess => guess.answerIndex === index)
              ? ButtonStyle.Danger
              : ButtonStyle.Secondary
        )
    )
  );
  return { embeds: [questionEmbed(commandName, question).setDescription(description)], components: [row] };
}
