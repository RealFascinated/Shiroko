import type { Placeholder, PlaceholderContext, PlaceholderValue } from "./placeholder";

/** Converts a resolved value to text; absent values render as "". */
function render(value: PlaceholderValue): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Resolves `{token}` placeholders in a template against a context.
 *
 * `C` is the context this executor supports. An executor built with
 * guild-scoped placeholders is `PlaceholderExecutor<GuildPlaceholderContext>`,
 * so its `replace` cannot be called without a guild.
 */
export default class PlaceholderExecutor<C extends PlaceholderContext = PlaceholderContext> {
  /** `{snake_case}` tokens; anything else is left untouched. */
  private static readonly TOKEN = /\{([a-z0-9_]+)\}/g;

  private readonly byKey: ReadonlyMap<string, Placeholder<C>>;

  public constructor(placeholders: ReadonlyArray<Placeholder<C>>) {
    this.byKey = new Map(placeholders.map(placeholder => [placeholder.key, placeholder]));
  }

  /**
   * Every registered placeholder, in registration order.
   */
  public get placeholders(): readonly Placeholder<C>[] {
    return [...this.byKey.values()];
  }

  /**
   * The executor's catalog: one line per token with its description, in
   * registration order. Lines show the `{key}` form, the exact text a
   * template would contain. Panels surface this in a read-only section so
   * a user can see what a message may contain.
   */
  public catalog(): string {
    return this.placeholders
      .map(placeholder => `- \`{${placeholder.key}}\`: ${placeholder.description}`)
      .join("\n");
  }

  public has(key: string): boolean {
    return this.byKey.has(key);
  }

  /**
   * The distinct placeholder keys a template uses, in first-seen order.
   * Used to validate config input and tell a real token from a typo.
   */
  public parse(template: string): readonly string[] {
    return [...new Set(Array.from(template.matchAll(PlaceholderExecutor.TOKEN), match => match[1]!))];
  }

  /**
   * Replace every known `{token}` in `template`. Unknown tokens are left
   * verbatim. Each distinct key resolves at most once per call, so a
   * template using `{guild_name}` twice resolves it once. Resolvers run in
   * parallel; the returned string preserves the template's token order.
   */
  public async replace(context: C, template: string): Promise<string> {
    const resolved = new Map<string, string>();
    await Promise.all(
      this.parse(template).map(async key => {
        const placeholder = this.byKey.get(key);
        if (placeholder !== undefined) {
          resolved.set(key, render(await placeholder.resolve(context)));
        }
      })
    );
    return template.replace(PlaceholderExecutor.TOKEN, (match, key: string) => resolved.get(key) ?? match);
  }
}
