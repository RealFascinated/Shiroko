import Component, { type ComponentContext, type ComponentType } from "@/component/component";
import { MessageFlags } from "discord.js";

export type TriviaHintPayload = {
  hint: string;
};

export const TRIVIA_HINT_COMPONENT_ID = "trivia-hint";

/**
 * The hint button on a trivia question. Reusable and shown only to the
 * presser, so asking for a hint never spoils it for the rest of the channel.
 */
export default class TriviaHintComponent extends Component<TriviaHintPayload> {
  public readonly componentId: string = TRIVIA_HINT_COMPONENT_ID;
  public readonly type: ComponentType = "button";

  public async handle({ payload, interaction }: ComponentContext<TriviaHintPayload>): Promise<void> {
    if (!interaction.isButton()) {
      return;
    }
    await interaction.reply({ content: `💡 ${payload.hint}`, flags: MessageFlags.Ephemeral });
  }
}
