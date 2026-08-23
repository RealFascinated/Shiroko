import type { CommandInteraction, Guild, User } from "discord.js";
import Command from "../command";

export default class TestCommand extends Command {
    
    constructor() {
        super("test", "Test");
    }

    public override async executeSlash(user: User, guild: Guild, ctx: CommandInteraction) {
        return ctx.reply(`Hello, ${user.username}!`);
    }
}
