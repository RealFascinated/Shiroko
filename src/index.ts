import { Client, Events, GatewayIntentBits } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import { env } from "./lib/env";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);

	readyClient.channels
		.fetch("1446633266160603268")
		.then(channel => {
			if (channel?.isVoiceBased()) {
				joinVoiceChannel({
					channelId: channel.id,
					guildId: channel.guild.id,
					adapterCreator: channel.guild.voiceAdapterCreator,
					selfMute: true,
				});
			}
		})
		.catch(console.error);
});

client.login(env.DISCORD_BOT_TOKEN);
