import { formatColor, parseColor } from "@/lib/color";
import { fetchGuildMember } from "@/lib/guild";
import Panel, { type PanelAccess, type PanelContext, type PanelControl, type PanelView } from "@/panel/panel";
import Permissions, { PermissionFlags } from "@/permission/permissions";
import { placeholders } from "@/placeholder";
import type { EmbedBuilder, Guild } from "discord.js";
import { welcomerSettings, type WelcomerSettingsData } from "./welcomer-settings";
import { welcomerService } from "./welcomer.service";

/**
 * The welcomer's panel, declared as controls over the guild's welcome
 * message. There is no bespoke rendering or routing; the engine composes
 * the container, the controls, and the preview section from this
 * description, and the preview renders against whichever user opened the
 * panel.
 *
 * Reads and writes go through the standard `SettingsModule`, so an edit
 * writes one setting (`welcomer.title`) and the storage path is identical
 * to every other feature's.
 */
export default class WelcomerPanel extends Panel<WelcomerSettingsData> {
  public readonly segment = "welcomer";
  public readonly title = "Welcomer";

  /**
   * The `/welcomer` command gate only applies at open time; the router
   * handles the panel's own presses, and it can only be gated through
   * `access`, so the same flag is enforced here too.
   */
  public override readonly access: PanelAccess<WelcomerSettingsData> = {
    authorized: async context => {
      const member = await fetchGuildMember(context.guild, context.user.id);
      return (
        member !== null && Permissions.memberHas(context.guild, member, PermissionFlags.WELCOMER_COMMAND)
      );
    },
    denied: () => "You don't have permission to edit the welcomer.",
  };

  public async getConfig(guild: Guild): Promise<WelcomerSettingsData> {
    return welcomerSettings.allValues(guild.id);
  }

  public override async updateConfig(
    guild: Guild,
    _view: PanelView<WelcomerSettingsData>,
    key: string,
    value: unknown
  ): Promise<void> {
    // A control key is the setting key, so the write names one setting.
    await welcomerSettings.set(guild.id, key as keyof WelcomerSettingsData, value as never);
  }

  public override accent(config: WelcomerSettingsData): number {
    return config.color;
  }

  public views(): readonly PanelView<WelcomerSettingsData>[] {
    return [
      {
        id: "welcome",
        label: "Welcome",
        segment: "welcome",
        controls: config => controlsFor(config),
        sections: config => [
          ...(config.mode === "embed"
            ? [
                {
                  id: "preview",
                  kind: "embed" as const,
                  render: (current: WelcomerSettingsData, context: PanelContext): Promise<EmbedBuilder> =>
                    this.previewEmbed(current, context),
                },
              ]
            : [
                {
                  id: "preview",
                  kind: "text" as const,
                  render: (current: WelcomerSettingsData, context: PanelContext): Promise<string> =>
                    this.previewText(current, context),
                },
              ]),
          {
            id: "placeholders",
            kind: "text" as const,
            render: async (): Promise<string> =>
              ["## Placeholders", "-# The tokens this message can contain.", "", placeholders.catalog()].join(
                "\n"
              ),
          },
        ],
      },
    ];
  }

  /** The message as a real embed, for the panel's preview. */
  private async previewEmbed(message: WelcomerSettingsData, context: PanelContext): Promise<EmbedBuilder> {
    return welcomerService.previewEmbed(context.guild, message, context.user);
  }

  /** The resolved simple body, for the panel's preview. */
  private async previewText(message: WelcomerSettingsData, context: PanelContext): Promise<string> {
    const body = await welcomerService.previewText(context.guild, message, context.user);
    return ["## Preview", "-# Simple format, rendered with this server's values.", "", body].join("\n");
  }
}

/**
 * The one panel instance shared by the router and `/welcomer`. The panel
 * holds per-guild state (preview message ids), so two instances would let
 * the router and the command disagree about which preview message is out.
 */
export const welcomerPanel = new WelcomerPanel();

/**
 * A message body rendered for a field line. A multi-line body becomes a
 * fenced code block, which needs the fence at the start of its own line;
 * a single-line body is wrapped in inline code, and an empty body reads
 * as unset rather than as empty code.
 */
function formatParagraph(value: unknown): string {
  const text = String(value ?? "");
  if (text.includes("\n")) {
    return "\n```\n" + text + "\n```";
  }
  return text.length > 0 ? "`" + text + "`" : "*(none)*";
}

/**
 * The controls for the message. Only the fields its current mode uses are
 * offered, so a simple message has no title or colour control.
 */
export function controlsFor(message: WelcomerSettingsData): PanelControl<WelcomerSettingsData>[] {
  const controls: PanelControl<WelcomerSettingsData>[] = [];

  if (message.mode === "embed") {
    controls.push({
      kind: "dialog",
      key: "title",
      input: "text",
      label: "Title",
      hint: "Leave empty for no title.",
      format: formatParagraph,
    });
    controls.push({
      kind: "dialog",
      key: "description",
      input: "paragraph",
      label: "Description",
      hint: "Placeholders like {guild_name} and {user_mention} are replaced.",
      format: formatParagraph,
      validate: input => (input.trim().length > 0 ? null : "The description cannot be empty."),
    });
    controls.push({
      kind: "dialog",
      key: "color",
      input: "text",
      label: "Color",
      hint: "A hex colour such as #9b59b6.",
      format: value => `\`${formatColor(typeof value === "number" ? value : 0)}\``,
      validate: input => (parseColor(input) === null ? "Enter a colour such as `#9b59b6`." : null),
      transform: input => parseColor(input),
    });
  } else {
    controls.push({
      kind: "dialog",
      key: "simpleDescription",
      input: "paragraph",
      label: "Description",
      hint: "Placeholders like {guild_name} and {user_mention} are replaced.",
      format: formatParagraph,
      validate: input => (input.trim().length > 0 ? null : "The description cannot be empty."),
    });
  }

  controls.push({
    kind: "dialog",
    key: "channelId",
    input: "channel",
    label: "Channel",
    hint: "Where this message is sent. Clear the selection to disable it.",
    format: value => (typeof value === "string" ? `<#${value}>` : "*(none)*"),
  });
  controls.push({
    kind: "choice",
    key: "mode",
    label: "Format",
    options: () => [
      { value: "embed", label: "Embed" },
      { value: "simple", label: "Simple" },
    ],
  });
  controls.push({
    kind: "toggle",
    key: "ping",
    label: "Ping member",
    state: value => (value ? "On" : "Off"),
  });
  controls.push({
    kind: "view",
    key: "placeholders",
    label: "Placeholders",
    description: "The tokens this message can contain.",
  });
  return controls;
}
