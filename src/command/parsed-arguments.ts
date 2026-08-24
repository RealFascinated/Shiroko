import type {
  APIInteractionDataResolvedGuildMember,
  APIRole,
  CommandInteractionOptionResolver,
  GuildChannelResolvable,
  GuildMember,
  Role,
  User,
} from "discord.js";

/**
 * Typed bag of parsed slash options, mirroring Wild's `ParsedArguments`
 * (`args.get(0, Integer.class).orElse(1)`). Values are accessed by name.
 */
export default class ParsedArguments {
  private readonly resolver: Omit<CommandInteractionOptionResolver, "getMessage" | "getFocused">;

  constructor(resolver: Omit<CommandInteractionOptionResolver, "getMessage" | "getFocused">) {
    this.resolver = resolver;
  }

  public string(name: string): string | null {
    return this.resolver.getString(name);
  }

  public integer(name: string): number | null {
    return this.resolver.getInteger(name);
  }

  public number(name: string): number | null {
    return this.resolver.getNumber(name);
  }

  public boolean(name: string): boolean | null {
    return this.resolver.getBoolean(name);
  }

  public user(name: string): User | null {
    return this.resolver.getUser(name);
  }

  public channel<T extends GuildChannelResolvable = GuildChannelResolvable>(name: string): T | null {
    return this.resolver.getChannel(name) as T | null;
  }

  public role(name: string): Role | null {
    return this.resolver.getRole(name) as Role | null;
  }

  public member(name: string): GuildMember | null {
    return this.resolver.getMember(name) as GuildMember | null;
  }

  public mentionable(
    name: string
  ): User | Role | GuildMember | APIRole | APIInteractionDataResolvedGuildMember | null {
    return this.resolver.getMentionable(name);
  }
}
