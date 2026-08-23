import { Events } from "discord.js";
import type { Client } from "discord.js";
import type Command from "./command";
import TestCommand from "./impl/test.command";

export default class CommandManager {

    private commands: Command[] = [];

    constructor() {
        this.registerCommand(new TestCommand());

        console.log(`Registered commands: ${this.commands.length}`);
    }

    /**
     * Sync local commands with Discord: register/update every local command,
     * and delete any Discord command that no longer exists locally.
     */
    public async sync(client: Client): Promise<void> {
        const application = client.application;
        if (!application) {
            throw new Error("Application is not available; call sync after the client logs in");
        }
        const { commands } = application;
        const local = this.commands.map(command => command.slashCommand);

        // Delete Discord commands that no longer exist locally.
        const localNames = new Set(local.map(command => command.name));
        const remote = await commands.fetch();
        for (const remoteCommand of remote.values()) {
            if (!localNames.has(remoteCommand.name)) {
                await remoteCommand.delete();
                console.log(`Deleted stale command: ${remoteCommand.name}`);
            }
        }

        // Register/update all local commands.
        await commands.set(local);
        console.log(`Synced ${local.length} command(s)`);
    }

    /**
     * Register the interaction handler that dispatches chat-input slash commands
     * to their matching command's executeSlash.
     */
    public registerHandlers(client: Client): void {
        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) {
                return;
            }
            if (!interaction.guild) {
                return;
            }

            const command = this.commands.find(c => c.slashCommand.name === interaction.commandName);
            if (!command) {
                console.log(`Unknown command: ${interaction.commandName}`);
                return;
            }

            try {
                await command.executeSlash(interaction.user, interaction.guild, interaction);
            } catch (error) {
                console.error(`Error executing command "${interaction.commandName}":`, error);
            }
        });
    }

    private registerCommand(command: Command) {
        this.commands.push(command);
        console.log(`Registered command: ${command.id} - ${command.displayName}`);
    }
}