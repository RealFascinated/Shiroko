import type GlobalUser from "@/user/global-user";
import type { EmbedBuilder, Guild } from "discord.js";

/**
 * What a render or a press happens in: the guild the panel is configuring,
 * and the user who opened or pressed it. Previews and personal panels
 * read the user; everything else reads the guild.
 */
export interface PanelContext {
  readonly guild: Guild;
  readonly user: GlobalUser;
}

/** Renders one configured value as display text. */
export type PanelFormatter<C, V = unknown> = (value: V, config: C, context: PanelContext) => string;

export interface ToggleControl<C> {
  kind: "toggle";
  key: string;
  label: string;
  /** A short explanation shown under the field line. */
  description?: string;
  /** The state suffix on the button, e.g. `(v) => (v ? "On" : "Off")`. */
  state(value: boolean, config: C, context: PanelContext): string;
  /**
   * Validate the finalized value before it is stored; return an error
   * message, or `null` when valid. Runs after any transform, so it sees
   * the value as it will be persisted.
   */
  validateValue?(value: unknown, config: C, context: PanelContext): string | null;
}

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * A choice: a select menu that applies on pick. Options may depend on the
 * configuration, so a control can offer different choices in different
 * states (a message's embed fields versus its simple field).
 */
export interface ChoiceControl<C> {
  kind: "choice";
  key: string;
  label: string;
  /** A short explanation shown under the field line. */
  description?: string;
  options(config: C, context: PanelContext): readonly ChoiceOption[];
  /**
   * Validate the finalized value before it is stored; return an error
   * message, or `null` when valid. Runs after any transform, so it sees
   * the value as it will be persisted.
   */
  validateValue?(value: unknown, config: C, context: PanelContext): string | null;
}

export interface DialogControl<C> {
  kind: "dialog";
  key: string;
  /**
   * Single-line text, paragraph text, a channel picker, a role picker, or
   * a multi-role picker. The native pickers read back resolved ids.
   */
  input: "text" | "paragraph" | "channel" | "role" | "role-list";
  /** Maximum roles for a `role-list` picker; defaults to Discord's select cap. */
  maxRoles?: number;
  /** Label above the input, and the field line's label. */
  label: string;
  /** A short explanation shown under the field line. */
  description?: string;
  hint?: string;
  /** The modal's title, when it should differ from the label. */
  modalTitle?: string;
  /** The button's caption, e.g. `(v) => \`✏️ ${v}\``. */
  button?(value: unknown, config: C, context: PanelContext): string;
  /** Current value formatting for the field list; the raw string by default. */
  format?: PanelFormatter<C>;
  /** Validate the input; return an error message, or `null` when valid. */
  validate?(input: string, config: C, context: PanelContext): string | null;
  /**
   * Validate the finalized value before it is stored; return an error
   * message, or `null` when valid. Runs after any transform, so it sees
   * the value as it will be persisted.
   */
  validateValue?(value: unknown, config: C, context: PanelContext): string | null;
  /**
   * Convert the validated input into the stored value, for fields whose
   * storage type is not text (a hex colour becoming an int, say). The
   * input is stored as-is when omitted.
   */
  transform?(input: string, config: C, context: PanelContext): unknown;
}

/**
 * A read-only button with no setting behind it. On press it opens the
 * view's section named by `key` as its own message, so long reference
 * content (a token list, say) is shown on demand rather than under the
 * controls.
 */
export interface ViewControl<C> {
  kind: "view";
  key: string;
  label: string;
  /** A short explanation shown under the field line. */
  description?: string;
}

export type PanelControl<C> = ToggleControl<C> | ChoiceControl<C> | DialogControl<C> | ViewControl<C>;

/**
 * A read-only block rendered below a view's controls.
 *
 * A `text` section becomes a container on the panel message. An `embed`
 * section cannot: the panel message always carries the V2 flag, which
 * makes `embeds` inert, so an embed section is reconciled into its own
 * message below the panel.
 */
export interface PanelSection<C> {
  id: string;
  kind: "text" | "embed";
  render(config: C, context: PanelContext): Promise<PanelSectionContent | null>;
}

export type PanelSectionContent = string | EmbedBuilder;

/**
 * A named set of controls. A view owns which controls are on offer and
 * what it reads and writes; control keys are dotted paths into the
 * panel's whole config, so switching views switches the editable state.
 */
export interface PanelView<C> {
  id: string;
  label: string;
  /** Custom-id segment for this view, unique within the panel. */
  segment: string;
  controls(config: C, context: PanelContext): readonly PanelControl<C>[];
  sections?(config: C, context: PanelContext): readonly PanelSection<C>[];
  /** Extra field lines for the current view, e.g. which view is active. */
  summary?(config: C, context: PanelContext): readonly string[];
}

/**
 * Restricts a panel to its author, when the action is personal rather
 * than administrative.
 */
export interface PanelAccess<C> {
  authorized(context: PanelContext, config: C): Promise<boolean>;
  /** The ephemeral reply a non-author gets. */
  denied(): string;
}

/**
 * The custom-id prefix every panel component carries.
 */
export const PANEL_PREFIX = "panel";

/** The decoded parts of a panel custom id. */
export interface PanelCustomId {
  segment: string;
  viewSegment: string;
  kind: "root" | "toggle" | "choice" | "dialog" | "view";
  /** The dotted config path the component edits; views and view buttons carry none. */
  path: string | null;
}

/** The custom id for a component, comfortably inside Discord's 100-char cap. */
export function panelCustomId(
  segment: string,
  viewSegment: string,
  kind: PanelCustomId["kind"],
  path?: string
): string {
  const head = `${PANEL_PREFIX}:${segment}:${viewSegment}`;
  return kind === "root" ? head : `${head}:${kind}:${path}`;
}

/**
 * Decode a component custom id, returning `null` when it does not belong
 * to the panel system. Paths are dotted, so a path never contains a colon
 * and the parse is unambiguous.
 */
export function parsePanelCustomId(customId: string): PanelCustomId | null {
  const parts = customId.split(":");
  if (parts[0] !== PANEL_PREFIX) {
    return null;
  }
  const [, segment, viewSegment, kind, path, ...extra] = parts;
  if (!segment || !viewSegment) {
    return null;
  }
  if (parts.length === 3) {
    return { segment, viewSegment, kind: "root", path: null };
  }
  if (
    extra.length > 0 ||
    !path ||
    (kind !== "toggle" && kind !== "choice" && kind !== "dialog" && kind !== "view")
  ) {
    return null;
  }
  return { segment, viewSegment, kind, path };
}

/**
 * A Components V2 configuration panel: one generic engine rendering an
 * embed-like container of fields, the controls that edit them, and any
 * read-only sections such as a preview, from a declarative description.
 *
 * A panel is generic over its config type `C` exactly like
 * `SettingsModule<C>`: controls name dotted paths into `C`, and the engine
 * reads and writes them immutably. A panel with one state defines a single
 * view; a panel that edits several things defines one view each and gets a
 * switcher for free.
 */
export default abstract class Panel<C extends object> {
  /** Custom-id namespace, unique across every registered panel. */
  public abstract readonly segment: string;
  public abstract readonly title: string;
  public readonly subtitle: string | undefined = undefined;

  /**
   * Read the panel's whole config for a guild.
   */
  public abstract getConfig(guild: Guild): Promise<C>;

  /**
   * Persist one edited setting. The engine knows the view and the exact
   * control key that changed, so a panel writes a single setting rather
   * than re-storing its whole config, exactly like the settings store
   * (one row per `<namespace>.<key>`).
   */
  public abstract updateConfig(guild: Guild, view: PanelView<C>, key: string, value: unknown): Promise<void>;

  /**
   * The panel's views. The first is the one shown on open.
   */
  public abstract views(config: C): readonly PanelView<C>[];

  /**
   * Restricts the panel to its author, when the action is personal rather
   * than administrative.
   */
  public readonly access: PanelAccess<C> | undefined = undefined;

  public accent?(config: C, view: PanelView<C>, context: PanelContext): number | undefined;

  public intro?(config: C, context: PanelContext): readonly string[];

  public footer?(config: C, context: PanelContext): string | undefined;

  /**
   * The view a custom id's segment names, falling back to the default when
   * the segment is unknown (a panel edited since the message was sent).
   */
  public viewFor(config: C, viewSegment: string): PanelView<C> {
    const views = this.views(config);
    return views.find(view => view.segment === viewSegment) ?? views[0]!;
  }

  /**
   * The message below the panel that carries its embed sections, or null
   * when none is out. An embed cannot ride on the panel message itself
   * (its V2 flag makes `embeds` inert), so the engine keeps it as a
   * companion.
   */
  private readonly embedMessages = new Map<string, string>();

  public embedMessageId(guild: Guild): string | null {
    return this.embedMessages.get(guild.id) ?? null;
  }

  public rememberEmbedMessage(guild: Guild, messageId: string | null): void {
    if (messageId === null) {
      this.embedMessages.delete(guild.id);
      return;
    }
    this.embedMessages.set(guild.id, messageId);
  }
}
