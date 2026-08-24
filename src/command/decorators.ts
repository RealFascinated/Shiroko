import "reflect-metadata";
import { ApplicationCommandOptionType } from "discord.js";

/**
 * Declarative metadata for a command, mirroring Wild's `@CommandInfo`
 * (`name`, `aliases`, `description`, `onlyConsole`, `hidden`).
 */
export interface CommandInfoMetadata {
  name: string;
  description: string;
  aliases?: string[];
  hidden?: boolean;
}

export function CommandInfo(metadata: CommandInfoMetadata): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata("command:info", metadata, target);
  };
}

/**
 * Declarative option declaration for a command, mirroring Wild's
 * `registerCommandArgument(ICommandArgument, required, name)`.
 */
export interface CommandOptionMetadata {
  type: ApplicationCommandOptionType;
  required: boolean;
  name: string;
  description: string;
  choices?: Record<string, string | number | boolean>;
  minValue?: number;
  maxValue?: number;
}

export function CommandOption(metadata: CommandOptionMetadata): PropertyDecorator {
  return (target, key) => {
    const existing: CommandOptionMetadata[] = Reflect.getMetadata("command:options", target) ?? [];
    existing.push({ ...metadata, name: String(key) });
    Reflect.defineMetadata("command:options", existing, target);
  };
}
