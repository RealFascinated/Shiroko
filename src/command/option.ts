import { ApplicationCommandOptionType } from "discord.js";

/**
 * A single slash-command option declaration, mirroring
 * `WildCommand.registerCommandArgument(ICommandArgument, required, name)`.
 */
export interface CommandOption {
  name: string;
  description: string;
  type: ApplicationCommandOptionType;
  required: boolean;
  choices?: Record<string, string | number | boolean>;
  minValue?: number;
  maxValue?: number;
}

export type CommandOptionDescriptor = Partial<Pick<CommandOption, "choices" | "minValue" | "maxValue">>;

export type CommandOptionBuilder = CommandOption;

export function stringOption(required: boolean, name: string, description: string): CommandOptionBuilder;
export function stringOption(
  required: boolean,
  name: string,
  description: string,
  options: CommandOptionDescriptor
): CommandOptionBuilder;
export function stringOption(
  required: boolean,
  name: string,
  description: string,
  options: CommandOptionDescriptor = {}
): CommandOptionBuilder {
  return { name, description, type: ApplicationCommandOptionType.String, required, ...options };
}

export function userOption(required: boolean, name: string, description: string): CommandOptionBuilder {
  return { name, description, type: ApplicationCommandOptionType.User, required };
}

export function channelOption(required: boolean, name: string, description: string): CommandOptionBuilder {
  return { name, description, type: ApplicationCommandOptionType.Channel, required };
}

export function roleOption(required: boolean, name: string, description: string): CommandOptionBuilder {
  return { name, description, type: ApplicationCommandOptionType.Role, required };
}

export function integerOption(
  required: boolean,
  name: string,
  description: string,
  minValue?: number,
  maxValue?: number
): CommandOptionBuilder;
export function integerOption(
  required: boolean,
  name: string,
  description: string,
  options?: CommandOptionDescriptor
): CommandOptionBuilder;
export function integerOption(
  required: boolean,
  name: string,
  description: string,
  ...rest: Array<number | CommandOptionDescriptor | undefined>
): CommandOptionBuilder {
  const base: CommandOptionBuilder = {
    name,
    description,
    type: ApplicationCommandOptionType.Integer,
    required,
  };
  const first = rest[0];
  if (typeof first === "number") {
    return { ...base, minValue: first, maxValue: rest[1] as number | undefined };
  }
  return { ...base, ...(first ?? {}) };
}

export function booleanOption(required: boolean, name: string, description: string): CommandOptionBuilder {
  return { name, description, type: ApplicationCommandOptionType.Boolean, required };
}

export function numberOption(required: boolean, name: string, description: string): CommandOptionBuilder {
  return { name, description, type: ApplicationCommandOptionType.Number, required };
}

export function mentionableOption(
  required: boolean,
  name: string,
  description: string
): CommandOptionBuilder {
  return { name, description, type: ApplicationCommandOptionType.Mentionable, required };
}

export function attachmentOption(required: boolean, name: string, description: string): CommandOptionBuilder {
  return { name, description, type: ApplicationCommandOptionType.Attachment, required };
}

export { ApplicationCommandOptionType };
