import { EmbedBuilder } from "discord.js";
import { discordClient } from "..";
import { Constants } from "../constants";

/**
 * Build a new embed pre-configured with the bot's brand color and footer.
 * Chain builder methods after calling this.
 */
export function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Constants.mainColor)
    .setFooter({ text: discordClient.user?.displayName! });
}
