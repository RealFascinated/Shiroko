import type Command from "./command";

/**
 * Every registered command, keyed by its top-level id. Kept in a leaf module
 * so a feature constructor can register synchronously without importing the
 * command manager, whose dispatch imports feature gating.
 */
export default class CommandRegistry {
  private static readonly COMMANDS: Map<string, Command> = new Map<string, Command>();

  public static register(command: Command): void {
    if (CommandRegistry.COMMANDS.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }
    CommandRegistry.COMMANDS.set(command.id, command);
    console.log(`Registered command: ${command.id} - ${command.displayName}`);
    for (const sub of command.subCommands.values()) {
      console.log(`  └─ ${sub.id} - ${sub.displayName}`);
    }
  }

  public static get(id: string): Command | undefined {
    return CommandRegistry.COMMANDS.get(id);
  }

  public static all(): Command[] {
    return Array.from(CommandRegistry.COMMANDS.values());
  }
}
