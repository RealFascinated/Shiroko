import { MessageFlags, type RepliableInteraction } from "discord.js";

/**
 * Tell the user a handler threw, so Discord does not show "application did
 * not respond". Never rejects: the interaction may already be gone.
 */
export async function replyFailure(interaction: RepliableInteraction): Promise<void> {
  const payload = { content: "Something went wrong running that.", flags: MessageFlags.Ephemeral } as const;
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    // The interaction token expired or was already answered.
  }
}
