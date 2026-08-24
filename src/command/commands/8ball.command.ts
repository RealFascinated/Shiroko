import { baseEmbed } from "../../lib/embed";
import Command, { type ExecuteContext } from "../command";
import type { CommandOptionBuilder } from "../option";
import { stringOption } from "../option";

const ANSWERS = [
  "Yes",
  "No",
  "Without a doubt",
  "Ask again later",
  "Definitely",
  "Very doubtful",
  "Most likely",
  "Cannot predict now",
];

export default class EightBallCommand extends Command {
  constructor() {
    super("8ball", "Ask the magic 8-ball a question");
  }

  public override get options(): CommandOptionBuilder[] {
    return [stringOption(true, "question", "The question you want to ask")];
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx }: ExecuteContext) {
    const question = ctx.options.getString("question", true)!;
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    return ctx.reply({
      embeds: [baseEmbed().setTitle("🎱 Magic 8-ball").setDescription(`> ${question}\n\n**${answer}**`)],
    });
  }
}
