import type GlobalUser from "@/user/global-user";
import { describe, expect, test } from "bun:test";
import { EmbedBuilder, type Guild } from "discord.js";
import Panel, { type PanelContext, type PanelView } from "./panel";
import { displayValue, renderPanel, UNSET_VALUE } from "./render";

/** A two-view panel over a nested config, exercising every control kind. */
interface DemoConfig {
  first: { name: string; count: string; on: boolean; channel: string | null };
  second: { name: string };
}

class DemoPanel extends Panel<DemoConfig> {
  public readonly segment: string = "demo";
  public readonly title: string = "Demo";

  public async getConfig(): Promise<DemoConfig> {
    return { first: { name: "Alpha", count: "3", on: true, channel: "9" }, second: { name: "Beta" } };
  }

  public async updateConfig(): Promise<void> {}

  public views(): readonly PanelView<DemoConfig>[] {
    return [
      {
        id: "first",
        label: "First",
        segment: "first",
        controls: () => [
          {
            kind: "dialog",
            key: "first.name",
            input: "text",
            label: "Name",
            description: "A display name",
            placeholders: { catalog: () => "- `{user_name}`: The name." },
          },
          { kind: "toggle", key: "first.on", label: "Enabled", state: v => (v ? "On" : "Off") },
          {
            kind: "choice",
            key: "first.count",
            label: "Count",
            options: () => [
              { value: "3", label: "Three" },
              { value: "4", label: "Four" },
            ],
          },
        ],
        sections: () => [
          {
            id: "preview",
            kind: "text" as const,
            render: (config, ctx) => Promise.resolve(`preview of ${ctx.user.id} ${config.first.name}`),
          },
        ],
      },
      { id: "second", label: "Second", segment: "second", controls: () => [] },
    ];
  }
}

const guild = { id: "1", channels: { cache: { has: () => true } } } as unknown as Guild;
const user = { id: "7", firstSeen: new Date(0), discordUser: {} } as unknown as GlobalUser;
const context: PanelContext = { guild, user };

/**
 * A panel whose only view is a single-mode message, for the mode test.
 */
class ModePanel extends Panel<{ mode: "embed" | "simple" }> {
  public readonly segment: string = "mode";
  public readonly title: string = "Mode";
  public async getConfig(): Promise<{ mode: "embed" | "simple" }> {
    return { mode: this.simple ? "simple" : "embed" };
  }
  public async updateConfig(): Promise<void> {}
  public constructor(private readonly simple: boolean) {
    super();
  }
  public views(): readonly PanelView<{ mode: "embed" | "simple" }>[] {
    return [
      {
        id: "m",
        label: "M",
        segment: "m",
        controls: config =>
          config.mode === "simple"
            ? [{ kind: "dialog", key: "simple", input: "paragraph", label: "Description" }]
            : [{ kind: "dialog", key: "title", input: "text", label: "Title" }],
      },
    ];
  }
}

/**
 * A panel whose single view previews with a real embed.
 */
class EmbedPanel extends Panel<{ title: string }> {
  public readonly segment: string = "embed-demo";
  public readonly title: string = "Embed";
  public async getConfig(): Promise<{ title: string }> {
    return { title: "Preview title" };
  }
  public async updateConfig(): Promise<void> {}
  public views(): readonly PanelView<{ title: string }>[] {
    return [
      {
        id: "m",
        label: "M",
        segment: "m",
        controls: () => [],
        sections: () => [
          {
            id: "preview",
            kind: "embed" as const,
            render: async config => new EmbedBuilder().setTitle(config.title),
          },
        ],
      },
    ];
  }
}

/**
 * A panel whose single view previews with a generated image.
 */
class ImagePanel extends Panel<object> {
  public readonly segment: string = "image-demo";
  public readonly title: string = "Image";
  public async getConfig(): Promise<object> {
    return {};
  }
  public async updateConfig(): Promise<void> {}
  public views(): readonly PanelView<object>[] {
    return [
      {
        id: "m",
        label: "M",
        segment: "m",
        controls: () => [],
        sections: () => [{ id: "card", kind: "image" as const, render: async () => Buffer.from("png") }],
      },
    ];
  }
}

/**
 * A panel whose ten toggles share a group, enough for two pages.
 */
class ChecklistPanel extends Panel<Record<string, boolean>> {
  public readonly segment: string = "checklist";
  public readonly title: string = "Checklist";
  public async getConfig(): Promise<Record<string, boolean>> {
    return { t0: true };
  }
  public async updateConfig(): Promise<void> {}
  public views(): readonly PanelView<Record<string, boolean>>[] {
    return [
      {
        id: "m",
        label: "M",
        segment: "m",
        controls: () =>
          Array.from({ length: 10 }, (_, index) => ({
            kind: "toggle" as const,
            key: `t${index}`,
            label: `T${index}`,
            group: "Types",
            state: (v: boolean): string => (v ? "On" : "Off"),
          })),
      },
    ];
  }
}

describe("displayValue", () => {
  test("shows a dialog's raw string as code", async () => {
    const control = { kind: "dialog" as const, key: "first.name", input: "text" as const, label: "Name" };
    expect(displayValue(control, await new DemoPanel().getConfig(), context)).toBe("`Alpha`");
  });

  test("shows multi-line text as a code block", () => {
    const control = { kind: "dialog" as const, key: "body", input: "paragraph" as const, label: "Body" };
    expect(displayValue(control, { body: "a\nb" }, context)).toBe("```\na\nb\n```");
  });

  test("uses a dialog's formatter when present", async () => {
    const control = {
      kind: "dialog" as const,
      key: "first.channel",
      input: "channel" as const,
      label: "Channel",
      format: (value: unknown) => `<#${value}>`,
    };
    expect(displayValue(control, await new DemoPanel().getConfig(), context)).toBe("<#9>");
  });

  test("renders a toggle through its state function", async () => {
    const control = {
      kind: "toggle" as const,
      key: "first.on",
      label: "Enabled",
      state: (v: boolean) => (v ? "On" : "Off"),
    };
    expect(displayValue(control, await new DemoPanel().getConfig(), context)).toBe("On");
  });

  test("renders a choice through its matching option", async () => {
    const control = {
      kind: "choice" as const,
      key: "first.count",
      label: "Count",
      options: () => [
        { value: "3", label: "Three" },
        { value: "4", label: "Four" },
      ],
    };
    expect(displayValue(control, await new DemoPanel().getConfig(), context)).toBe("Three");
  });

  test("reports every unset shape the same way, without calling the formatter", () => {
    const control = {
      kind: "dialog" as const,
      key: "value",
      input: "text" as const,
      label: "Value",
      format: (): string => "formatted",
    };
    for (const value of [null, undefined, "", []]) {
      expect(displayValue(control, { value }, context)).toBe(UNSET_VALUE);
    }
  });
});

describe("renderPanel", () => {
  test("renders one container per view section, plus the settings block", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    expect(rendered.flags).toBe(1 << 15);
    expect(rendered.components).toHaveLength(2);
  });

  test("draws embed sections as a container on the panel message", async () => {
    const rendered = await renderPanel(new EmbedPanel(), context, "m");
    expect(rendered.components).toHaveLength(2);
    expect(JSON.stringify(rendered.components[1]!.toJSON())).toContain("Preview title");
  });

  test("attaches image sections and shows them in a media gallery", async () => {
    const rendered = await renderPanel(new ImagePanel(), context, "m");
    expect(rendered.files.map(file => file.name)).toEqual(["card.png"]);
    expect(rendered.attachments).toEqual([]);
    expect(JSON.stringify(rendered.components[1]!.toJSON())).toContain("attachment://card.png");
  });

  test("includes the heading, fields, and control labels", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("Demo");
    expect(json).toContain("Alpha");
    expect(json).toContain("Enabled");
    expect(json).toContain("Count");
    expect(json).toContain("panel:demo:first:dialog:first.name");
    expect(json).toContain("panel:demo:first:toggle:first.on");
    expect(json).toContain("panel:demo:first:choice:first.count");
  });

  test("pages a toggle group, a toggle button per row", async () => {
    const rendered = await renderPanel(new ChecklistPanel(), context, "m");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("1 of 10");
    expect(json).toContain("panel:checklist:m:toggle:t7");
    expect(json).not.toContain("panel:checklist:m:toggle:t8");
    expect(json).toContain("panel:checklist:m:page:t0");
    expect(json).toContain("panel:checklist:m:page:t8");
  });

  test("shows the page holding the focused toggle", async () => {
    const rendered = await renderPanel(new ChecklistPanel(), context, "m", "t9");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("2 of 2");
    expect(json).toContain("panel:checklist:m:toggle:t9");
    expect(json).not.toContain("panel:checklist:m:toggle:t0");
  });

  test("renders the view switcher when there is more than one view", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("panel:demo:first");
    expect(json).toContain("Second");
  });

  test("passes the acting user into section rendering", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("Alpha");
  });

  test("falls back to the first view for an unknown segment", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "gone");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("Alpha");
  });

  test("renders only the controls the current state offers", async () => {
    const simple = await renderPanel(new ModePanel(true), context, "m");
    const embed = await renderPanel(new ModePanel(false), context, "m");
    expect(JSON.stringify(simple.components.map(c => c.toJSON()))).toContain("panel:mode:m:dialog:simple");
    expect(JSON.stringify(embed.components.map(c => c.toJSON()))).toContain("panel:mode:m:dialog:title");
  });

  test("has no view switcher for a single-view panel", async () => {
    const rendered = await renderPanel(new ModePanel(false), context, "m");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).not.toContain('"custom_id":"panel:mode:m"');
  });

  test("adds a placeholders button for a template field", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("panel:demo:first:placeholders:first.name");
    expect(json).toContain("Placeholders");
  });

  test("renders a control's description under its value line", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("A display name");
  });
});
