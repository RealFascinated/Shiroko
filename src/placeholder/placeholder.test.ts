import type GlobalUser from "@/user/global-user";
import { describe, expect, test } from "bun:test";
import { definePlaceholder, type PlaceholderContext } from "./placeholder";
import PlaceholderExecutor from "./placeholder-executor";

/** The executor never reads the user, so a stub id is enough. */
function context(): PlaceholderContext {
  return { globalUser: { id: "7" } as unknown as GlobalUser };
}

const executor = new PlaceholderExecutor<PlaceholderContext>([
  definePlaceholder({ key: "name", description: "test", resolve: () => "Shiroko" }),
  definePlaceholder({ key: "count", description: "test", resolve: () => 3 }),
  definePlaceholder({ key: "absent", description: "test", resolve: () => null }),
  definePlaceholder({ key: "undefined", description: "test", resolve: () => undefined }),
]);

describe("PlaceholderExecutor", () => {
  test("replaces known tokens, preserving template order", async () => {
    expect(await executor.replace(context(), "{count} for {name}")).toBe("3 for Shiroko");
  });

  test("leaves unknown tokens verbatim", async () => {
    expect(await executor.replace(context(), "Hello {nope}!")).toBe("Hello {nope}!");
  });

  test("renders null and undefined as empty", async () => {
    expect(await executor.replace(context(), "[{absent}][{undefined}]")).toBe("[][]");
  });

  test("ignores text that is not a lowercase snake_case token", async () => {
    const template = "{Name} {UPPER} {with space} {hyphen-name} {}";
    expect(await executor.replace(context(), template)).toBe(template);
  });

  test("parses distinct keys in first-seen order", () => {
    expect(executor.parse("{b} {a} {b} {c}")).toEqual(["b", "a", "c"]);
    expect(executor.parse("no tokens here")).toEqual([]);
  });

  test("reports whether a key is registered", () => {
    expect(executor.has("name")).toBe(true);
    expect(executor.has("nope")).toBe(false);
  });

  test("exposes the registered placeholders in order", () => {
    expect(executor.placeholders.map(placeholder => placeholder.key)).toEqual([
      "name",
      "count",
      "absent",
      "undefined",
    ]);
  });

  test("resolves each distinct key once", async () => {
    let calls = 0;
    const counting = new PlaceholderExecutor<PlaceholderContext>([
      definePlaceholder({
        key: "x",
        description: "test",
        resolve: () => {
          calls++;
          return "x";
        },
      }),
    ]);
    await counting.replace(context(), "{x} {x} {x}");
    expect(calls).toBe(1);
  });

  test("awaits async resolvers", async () => {
    const async = new PlaceholderExecutor<PlaceholderContext>([
      definePlaceholder({ key: "slow", description: "test", resolve: async () => "done" }),
    ]);
    expect(await async.replace(context(), "{slow}")).toBe("done");
  });
});
