import type { ExecuteContext } from "@/command/command";
import ComponentCommand from "@/component/component-command";
import { componentCustomId, type ComponentContext, type ComponentType } from "@/component/component";
import Components from "@/component/components";
import { baseEmbed, errorEmbed } from "@/lib/embed";
import { titleCase } from "@/lib/format";
import { TimeUnit } from "@/lib/time";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import TriviaService, { type TriviaQuestion } from "../trivia.service";

const ANSWER_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Minute, 30);
const LABEL_LIMIT = 80;

type TriviaAnswerPayload = {
  question: string;
  answer: string;
  correctAnswer: string;
  correct: boolean;
  commandName: string;
};

/**
 * One random trivia question with four answer buttons: the first correct press
 * wins and the buttons die with the message's components; a wrong press consumes
 * that one button and only the presser sees it.
 */
export default class TriviaCommand extends ComponentCommand<TriviaAnswerPayload> {
  public readonly type: ComponentType = "button";
  public override readonly oneShot: boolean = true;

  constructor() {
    super({ id: "trivia", displayName: "Answer a random trivia question" });
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    await ctx.deferReply();
    let question: TriviaQuestion;
    try {
      question = await TriviaService.fetchQuestion();
    } catch {
      await ctx.editReply({
        embeds: [errorEmbed(commandName).setDescription("Trivia is unavailable, try again later.")],
      });
      return;
    }

    const message = await ctx.editReply({ embeds: [questionEmbed(commandName, question)] });
    const components = await Promise.all(
      question.answers.map((answer, index) =>
        Components.create({
          guildId: ctx.guildId,
          channelId: message.channel.id,
          messageId: message.id,
          userId: null,
          type: this.type,
          extraData: {
            question: question.question,
            answer,
            correctAnswer: question.answers[question.correctIndex]!,
            correct: index === question.correctIndex,
            commandName,
          },
          expiresAt: new Date(Date.now() + ANSWER_WINDOW_MS),
        })
      )
    );
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      components.map(component => {
        const payload = component.extraData as TriviaAnswerPayload;
        return new ButtonBuilder()
          .setCustomId(componentCustomId(this.componentId, component.id))
          .setLabel(payload.answer.slice(0, LABEL_LIMIT))
          .setStyle(ButtonStyle.Secondary);
      })
    );
    await ctx.editReply({ components: [row] });
  }

  public async handle({ payload, interaction }: ComponentContext<TriviaAnswerPayload>): Promise<void> {
    if (!interaction.isButton()) {
      return;
    }
    if (!payload.correct) {
      await interaction.reply({
        content: `❌ **${payload.answer}** isn't it, but the guess is yours to keep.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Drop all four rows first so sibling buttons never answer after the reveal,
    // then update the shared message so everyone shares the outcome.
    await Components.deleteByMessage(interaction.message.id);
    await interaction.update({
      embeds: [
        baseEmbed(payload.commandName)
          .setTitle("❓ Trivia")
          .setDescription(
            `${payload.question}\n\n✅ <@${interaction.user.id}> got it: **${payload.correctAnswer}**`
          ),
      ],
      components: [],
    });
  }
}

function questionEmbed(commandName: string, question: TriviaQuestion) {
  return baseEmbed(commandName)
    .setTitle("❓ Trivia")
    .setDescription(question.question)
    .addFields(
      { name: "Category", value: question.category, inline: true },
      { name: "Difficulty", value: titleCase(question.difficulty), inline: true }
    );
}
