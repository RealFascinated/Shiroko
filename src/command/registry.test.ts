import { describe, expect, test } from "bun:test";
import { Collection, type ApplicationCommand } from "discord.js";
import Command from "./command";
import CommandManager from "./index";
import CommandRegistry from "./registry";

class TestCommand extends Command {}

describe("CommandRegistry", () => {
  test("rejects a duplicate id", () => {
    CommandRegistry.register(new TestCommand({ id: "registry-dup", displayName: "First" }));
    expect(() =>
      CommandRegistry.register(new TestCommand({ id: "registry-dup", displayName: "Second" }))
    ).toThrow(/already registered/);
  });

  test("looks up a command by id", () => {
    const command = new TestCommand({ id: "registry-get", displayName: "Get" });
    CommandRegistry.register(command);
    expect(CommandRegistry.get("registry-get")).toBe(command);
    expect(CommandRegistry.get("registry-missing")).toBeUndefined();
  });

  test("builds a command once, so a reconnect cannot duplicate its subcommands", () => {
    const command = new TestCommand({ id: "registry-build", displayName: "Build" });
    command.registerSubCommand(new TestCommand({ id: "registry-build-sub", displayName: "Sub" }));
    const built = command.build();
    expect(command.build()).toBe(built);
    expect(built.toJSON().options).toHaveLength(1);
  });
});

describe("CommandManager.applyApplicationCommandIds", () => {
  test("stamps a parent and its subcommands", () => {
    const parent = new TestCommand({ id: "stamp-parent", displayName: "Parent" });
    const sub = new TestCommand({ id: "stamp-sub", displayName: "Sub" });
    parent.registerSubCommand(sub);
    CommandRegistry.register(parent);

    const cache = new Collection<string, ApplicationCommand>();
    cache.set("1", { name: "stamp-parent", id: "111" } as ApplicationCommand);
    CommandManager.applyApplicationCommandIds(cache);

    expect(parent.applicationCommandId).toBe("111");
    expect(sub.applicationCommandId).toBe("111");
  });

  test("leaves an id intact when the command is absent from the collection", () => {
    const absent = new TestCommand({ id: "stamp-absent", displayName: "Absent" });
    CommandRegistry.register(absent);
    absent.applicationCommandId = "222";

    CommandManager.applyApplicationCommandIds(new Collection());

    expect(absent.applicationCommandId).toBe("222");
  });
});
