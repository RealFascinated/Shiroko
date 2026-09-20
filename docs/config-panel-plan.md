# Config Panel Plan (components v2)

How feature configuration becomes a rich, interactive panel: one embed, a
row of buttons and selects, optional modal input, all built from typed
option descriptors with a generic engine. The goal is a single
`ConfigPanel<C>` class plus a small registry, so adding a new config option
is a few lines, not a new command file.

## 1. What exists today

The repo has no persistent component dispatch. Current state:

- `EventBridge` only posts chat-input and context-menu interactions
  (`isChatInputCommand`, `isUserContextMenuCommand` / `isMessageContextMenuCommand`).
  A button or select press is **dropped silently**.
- Buttons today are one-shot collectors on a single reply:
  `watchButtonPress` in `src/lib/embed.ts` and `attachPager` in
  `src/lib/pagination.ts`. They only work for the interaction that created
  the message and cannot drive a persistent panel.
- Config today is subcommand-per-setting (`/level-config`), a `getConfig` /
  `setConfig` drizzle upsert service, and a `view` subcommand showing a
  summary embed. That pattern works and is already in production.

The panel is therefore new plumbing: a bridge branch for component
interactions plus a registry keyed by custom id. Feasible, and worth it
once more than one feature needs config.

## 2. The dispatch core

### Bridge branch

In `src/event/event-bridge.ts`:

```ts
client.on(Events.InteractionCreate, interaction => {
  if (interaction.isChatInputCommand()) {
    void EventBus.post(new SlashCommandReceivedEvent(interaction));
  } else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
    void EventBus.post(new ContextMenuReceivedEvent(interaction));
  } else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
    void EventBus.post(new ComponentReceivedEvent(interaction));
  }
});
```

`ComponentReceivedEvent` wraps the interaction with the same shape as the
other events (guild, userId, raw interaction).

### Registry

A `ComponentRegistry` singleton in `src/feature/command/` (or
`src/component/`):

- `register(panel)` assigns a unique custom-id prefix per panel instance
  (e.g. `modcfg:<guildId>:<optionId>:<action>`), or slices a transient,
  per-message context off the id directly.
- `resolve(customId)` maps a press back to `(panelClass, guildId, optionId,
  action)` and hands the `ButtonInteraction` / `StringSelectMenuInteraction`
  / `ModalSubmitInteraction` to the panel's handler.
- Authorization is checked at resolve time: the pressing user must hold the
  same flags the command required (read from the panel's
  `requiredFlags`), the guild must match, and the message must not be too
  old (Discord already enforces 15-min interaction lifetime; a local
  window, e.g. 3 hours like `attachPager`, is a nice-to-have).
- One collector-based path (`watchButtonPress`) stays for one-shot cards;
  the panel is a distinct, message-persistent path.

This is ~60 lines of plumbing and is the single place component handling
lives. Without it, every panel hand-rolls its own collector and the
interaction never reaches a handler, because the bridge silences it.

## 3. `ConfigPanel<C>`

The generic core, one class reused by every feature's config.

```ts
type ConfigOptionKind =
  | { kind: "boolean" }
  | { kind: "role" }
  | { kind: "channel" }
  | { kind: "text"; maxLength?: number; minLength?: number }   // modal input
  | { kind: "number"; min?: number; max?: number }
  | { kind: "choices"; choices: Record<string, string> };      // select menu

interface ConfigOption<C> {
  id: string;                          // stable option id, also the custom-id segment
  label: string;                       // row label in the embed
  kind: ConfigOptionKind;
  read(config: C): string;             // render current value into the embed
  apply(value: ConfigValue, config: C): Promise<C>;  // persisted update
}

abstract class ConfigPanel<C> {
  abstract readonly title: string;
  abstract readonly description: string;
  abstract getConfig(guildId: string): Promise<C>;
  abstract setConfig(guildId: string, next: C): Promise<void>;
  abstract get options(): ConfigOption<C>[];

  /** Render the panel: embed + one row of buttons/selects per option. */
  render(guildId: string): Promise<MessageEditOptions>;

  /** Entry point handed the resolved (panel, guildId, optionId, action). */
  handle(interaction, optionId, action): Promise<void>;
}
```

Concrete panel:

```ts
class ModerationConfigPanel extends ConfigPanel<ModerationConfig> {
  options = [
    { id: "log-channel", label: "Mod-log channel", kind: { kind: "channel" }, ... },
    { id: "warn-action", label: "Auto-action on warnings", kind: { kind: "choices", choices: {...} }, ... },
  ];
}
```

### How a press flows

1. `render(guildId)` reads config, lays out the embed, and emits one
   `ButtonBuilder` / `StringSelectMenuBuilder` per option, with custom ids
   `<panelPrefix>:<guildId>:<optionId>:<action>` (e.g. `modcfg:123:log-channel:set`).
2. Press → bridge → `ComponentReceivedEvent` → `ComponentRegistry.resolve`.
3. The registry guards authorization, then calls `panel.handle(interaction,
   optionId, action)`.
4. `handle` switches on the kind:
   - `boolean`: toggle button, apply immediately.
   - `role` / `channel`: a **modal** with one input (open via
     `interaction.showModal` with the current value pre-filled) so the
     admin types or pastes an id. This keeps the option list generic: no
     per-option menus for role/channel pickers, which Discord does not
     provide inline.
   - `text`: modal input.
   - `number`: modal input with validation.
   - `choices`: `StringSelectMenu`, apply immediately.
5. After every apply, `setConfig` persists and `render` is re-run with
   `interaction.update(...)`. The panel stays on screen, updated in place.

Modals are the keystone that keeps the option system small: instead of
per-kind pickers for role/channel/name, one generic `showModal` path covers
`text`, `number`, `role`, `channel`. `apply` re-validates whatever the
modal returns (invalid role id: error ephemeral, panel unchanged).

### Generics and extensibility

- The engine is fully generic over `C`; options are declarative.
- Adding an option = one entry in `options` with `read` + `apply` +
  `kind`. No new command files, no new bridge code, no new registry code.
- The registry and bridge are shared by every feature's panel, so the
  system pays for itself once the second feature configures itself this
  way.
- `ConfigOptionKind` is a discriminated union, so `apply` can validate by
  kind without branching on strings everywhere; `ConfigValue` is the
  matching union. This matches the repo's "model variation with types"
  rule.

## 4. Costs and trade-offs

| Concern | Panel | Subcommands (status quo) |
| ------- | ----- | ------------------------ |
| New plumbing | Bridge branch + registry + modal handling | None |
| Per-setting cost | 1 option descriptor (~10 lines) | 1 command file (~40 lines) + 1 command class |
| Discoverability | Panel shows every setting at once | Needs `/config view` |
| Discord limits | 5 rows × 5 buttons/selects; embed field cap | None beyond command cap |
| Ephemerality | Modal submissions and updates are tied to the interaction, works fine | Fine |
| Restart safety | Panel messages go stale (custom ids reference a gone session); re-invoke the command | No state |
| Flag gating | Registry checks flags on every press | CommandManager already gates |

The panel is ~40% more upfront code (bridge branch, registry, modal
handlers, render/apply engine) and strictly better afterward. Static risk
is low: the bridge branch is additive, the registry is a new leaf module,
and commands that keep using one-shot buttons are untouched.

## 5. Rollout

1. `ComponentReceivedEvent` + bridge branch.
2. `ComponentRegistry` with resolve/authorize.
3. `ConfigPanel<C>` core: render, handle, modal, select, button paths.
4. First consumer: `ModerationConfigPanel` (mod-log channel). This is the
   proof case with one option and a concrete config row.
5. If the moderation panel lands cleanly, move `/level-config` over
   option-by-option (message-xp, cooldown, voice-xp, announce-channel,
   ignored-channels, reward roles) and delete the subcommand files once the
   panel covers every setting.

If the panel never gets a second consumer, the subcommand pattern stays
the default and the panel is a moderation-only island; the registry and
bridge remain small enough to be fine either way.