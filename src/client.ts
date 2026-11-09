import { Client, GatewayIntentBits } from "discord.js";

/**
 * The gateway client. Its own module so formatting code can read the client's
 * identity without importing the process entry point and everything it boots.
 */
export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildExpressions,
  ],
});
