# Permissions System Plan

A role-based permission system for Shiroko, modeled on Discord's own permission model: BigInt bitfield flags with per-role configuration and optional role inheritance.

## 1. Model

### Checks performed in order

1. **Guild owner** — always has every permission (all flags set).
2. **Administrator bypass** (configurable)— members with the Discord `Administrator` permission get all bot flags. Tradeoff: granting Discord `Administrator` to a role grants full bot control too. Behind the constant `ALLOW_ADMIN_BYPASS` so it can be flipped off.
3. **Effective role flags** — the OR of the member's roles' effective flags (own flags ∪ inherited flags across each role's ancestry chain).
4. **User install** — role checks never apply outside guilds. Commands with `userInstallable: true` must keep `requiredFlags = 0n`.

### Resolved semantics

- Each role is one row in `permission_roles`, keyed by `(guildId, roleId)`.
- `<@&guildId>` (the `@everyone` role) has a row like any other role; its `roleId` is the guild id.
- **Effective flags of a role** = own flags OR the effective flags of its parent, transitively (additive inheritance).
- **Effective flags of a member** = OR of effective flags over every role the member holds.
- A **cycle** in parent links is broken by the resolver (visited set) and logged as a warning. A **dangling parent** (parent row missing/deleted) resolves as no parent.
- No deny flags. OR-only semantics means there are no conflicts, which keeps this far simpler than Discord's allow/deny override model.

## 2. Flags

BigInt bitflags, one bit per permission. `1n << n` — **never number literals**: JS bitwise operators truncate to 32 bits, so flags past bit ~30 would silently corrupt.

One flag per command, named after the command it gates. Only commands that need a non-default gate declare one; everything else stays `requiredFlags = 0n`.

| Flag                  | Bit | Display name        | Gates                                       |
| --------------------- | --- | ------------------- | ------------------------------------------- |
| `FEATURE_COMMAND`     | 1   | Feature Command     | `/feature` — enable/disable server features |
| `PERMISSIONS_COMMAND` | 2   | Permissions Command | `/permissions` — configure role permissions |

Future commands add their own flag as needed (`INVITES_COMMAND`, `STATS_COMMAND`, …) following the same convention. Bits once assigned are **permanent**: stored rows persist, so a deprecated flag's bit must never be reused — reclaiming requires deleting the column and re-migrating.

A single `FLAG_DISPLAY_NAMES` registry maps enum → display name → bit, forming one source of truth used by both the command's choice labels and `view`'s decoding.

A bundled convenience flag `ALL_FLAGS = OR of every flag` is used for the "all perms" grants.

Serialized form: decimal string (`String(flags)`), matching how Discord serializes `Permission` values on the wire.

## 3. Schema

```ts
// src/db/schema.ts
export const permissionRoles = pgTable(
  "permission_roles",
  {
    guildId: text("guild_id").notNull(),
    roleId: text("role_id").notNull(), // @everyone role = guild.id
    flags: text("flags").notNull().default("0"),
    parentRoleId: text("parent_role_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.roleId] })]
);
```

Notes:

- `parentRoleId` has **no FK**: it is a self-referential, composite key (`guildId + roleId`) which drizzle can't express cleanly as a constraint. Enforce it in the app layer: parent must be another row in the same guild; a dangling parent is treated as no parent.
- `flags` stored as text to hold BigInt values losslessly.

Migration: `bunx drizzle-kit generate` — a new migration adding the `permission_roles` table, no backfill needed (empty rows fall back to no flags).

## 4. Resolution & caching

### Cache

`Permissions` keeps an in-memory `Map<string, { own: bigint; effective: bigint } | null>` keyed `guildId:roleId`, mirroring the `GuildFeatures.CACHE` pattern. Entries are cached on first resolution; writes and role events invalidate.

### Invalidation hooks

| Event                              | Action                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GuildRoleCreate`                  | `clearRole(guildId, roleId)` (no-op — no config yet)                                                                                  |
| `GuildRoleUpdate`                  | `clearRole(guildId, roleId)`                                                                                                          |
| `GuildRoleDelete`                  | `clearRoleCascade(guildId, roleId)` — also clears any role whose ancestry chain includes the deleted role; the deleted row is dropped |
| `GuildMemberUpdate`                | nothing — member flag sets are resolved per-call from role cache; no member-level cache                                               |
| Permission writes (`/permissions`) | `clearRoleCascade` for the written role                                                                                               |

`GuildRoleDelete` should also run a DB cleanup: `DELETE FROM permission_roles WHERE role_id = deleted` and `SET parent_role_id = NULL WHERE parent_role_id = deleted`.

Register via `Permissions.registerEventListener(event, listener, extractGuild)` mirroring `Feature.registerEventListener` — the invalidation hooks subscribe the same declarative way (event, listener, guild extractor), attached when the permission handlers register.

### Resolver

```ts
async function roleEffectiveFlags(guildId: string, roleId: string): Promise<bigint> {
  // cache hit → return own|effective (null → 0n)
  const rows = await db.select().from(permissionRoles).where(eq(permissionRoles.guildId, guildId));
  const byRole = new Map(rows.map(r => [r.roleId, { own: BigInt(r.flags), parent: r.parentRoleId }]));
  const visited = new Set<string>();
  let effective = 0n;
  let current: string | undefined = roleId;
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    const node = byRole.get(current);
    if (!node) break;
    effective |= node.own;
    current = node.parent;
  }
  if (visited.has(current)) {
    console.warn(`Permission cycle detected at role ${current} in guild ${guildId}`);
  }
  // cache own/effective, return
}

async function memberFlags(guild: Guild, member: GuildMember): Promise<bigint> {
  if (guild.ownerId === member.id) return ALL_FLAGS;
  if (ALLOW_ADMIN_BYPASS && member.permissions.has(PermissionFlagsBits.Administrator)) return ALL_FLAGS;
  let flags = 0n;
  for (const roleId of member.roles.cache.keys()) {
    flags |= await roleEffectiveFlags(guild.id, roleId);
  }
  return flags;
}
```

Avoid the N+1 warm-up: `roleEffectiveFlags` selects the whole guild's rows per call, so a member with many roles fires repeated identical queries before the cache fills. Resolve the full guild row map once per interaction (`loadGuild(guildId)` → cache), then walk chains in memory.

## 5. Command integration

```ts
// src/command/command.ts — alongside userInstallable
/** Flags required to run this command (guild-only). 0n = everyone. */
public get requiredFlags(): bigint {
  return 0n;
}
```

```ts
// src/command/index.ts — in the InteractionCreate handler, after the feature check
if (guild && command.requiredFlags !== 0n) {
  const member = await fetchGuildMember(guild, interaction.user.id);
  const flags = member ? await Permissions.memberFlags(guild, member) : 0n;
  if ((flags & command.requiredFlags) !== command.requiredFlags) {
    return interaction.reply({
      content: "You don't have permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
```

The `/feature` command drops its ad-hoc `isOwner || isAdmin` handler check in favor of `requiredFlags = PermissionFlags.FEATURE_COMMAND`.

**Subcommand gating**: the middleware checks the _top-level_ command only — `requiredFlags` on a subcommand is never consulted, since dispatch happens after the check. Today's flags gate whole commands, so this is fine. If a subcommand ever needs its own gate (e.g. a privileged `/invites manage`), extend the middleware to resolve `ctx.options.getSubcommand(false)` and check the subcommand's flags too. Do not put `requiredFlags` on a subcommand relying on this middleware until that lands.

## 6. Management command — `/permissions`

The one administration surface. Everything here requires `PERMISSIONS_COMMAND`, enforced via `requiredFlags`. Guild-only (role configuration has no meaning in DMs): `userInstallable: false`.

Fun-fact guardrail: this command must itself be **self-gating** — `requiredFlags != 0n` means the owner bypass is what lets the owner configure things in the first place, which is the intent.

### Command tree

```
/permissions
├── view [role?]
├── set <role> <flags…> [parent?]
├── inherit <role> [parent?]
└── clear <role>
```

### Subcommand details

**`/permissions view [role]`** — show configured permissions.

- Without `role`: list every configured row for the guild — role mention, own flags (decoded to display names), parent, and resolved effective flags. Grouped by ancestry chain for readability.
- With `role`: same detail for the one role, plus decoded effective flags.
- Fallback text when a role has no row yet: "No permissions configured — defaults to no flags."

**`/permissions set <role> <flags…> [parent]`** — set a role's own flags, replacing previous.

- `role`: `Role` option (mention). The `@everyone` role is selectable as the guild's default role.
- `flags…`: one or more `String`-choice options — **multiple invocations allowed** (e.g. `flag:Feature Command flag:Permissions Command`). Each choice's **label is the formatted display name** ("Feature Command"), mapped internally to its raw BigInt bit; the raw enum name or bit value is never shown to users. Choices come from the `PermissionFlags` enum display names. A `none` choice clears a role's flags.
- `parent`: optional `Role` option. Sets the parent for inheritance; `@everyone` is valid as a parent.
- Validation:
  - Parent must not be the role itself.
  - Chain must not already contain `role` (reject cycles: walk from `parent` up the ancestry chain; if `role` appears, refuse with an explanatory message).
  - Parent in a different guild is impossible (Role options are guild-scoped by Discord).
- Clears the whole cache (role + any descendants via `clearRoleCascade`).

**`/permissions inherit <role> [parent]`** — change only the parent link, leaving own flags untouched.

- With `parent`: set/replace the parent (same cycle validation as `set`).
- Without `parent`: clear the parent link (role becomes standalone).
- Upserts: calling `inherit` on a role with no row creates one with `0n` own flags (pure inheritance).
- Convenience: avoids re-typing flags when only restructuring hierarchy.

**`/permissions clear <role>`** — delete the role's row entirely. The role then resolves to no flags; it should be re-created via `set`. Descendants that pointed at it become dangling-parent → no inherited flags.

Each response echoes the resulting effective flags for the role so the config owner sees the resolved outcome immediately.

## 7. Nice-to-haves (deferred)

Not build now — noted so they survive if wanted later:

- **Active flag on roles**: a boolean toggle to disable a role's config without deleting its row.
- **Customizable flag presets** (server-defined named sets of flags for quick role setup).
- **`/permissions audit`**: a change log (who set what, when).
- **Overrides**: explicit deny semantics — deliberately out of scope; OR-only is the model.

## 8. Open decisions

1. **Administrator bypass**: apply (`ALLOW_ADMIN_BYPASS = true`, default) or owner-only? Recommendation: true, matching the existing `feature` command behavior; revisit if a guild wants moderator-tier control separated from admin.
2. **Additive vs replace inheritance**: leaning additive (child own flags union parent's). Replacing is also defensible — decide before the migration.

## 9. File touch list

| Path                                | Change                                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts`                  | add `permissionRoles` table, export row types                                                                                                                                                                                               |
| `drizzle/`                          | new migration via `drizzle-kit generate`                                                                                                                                                                                                    |
| `src/lib/permissions.ts` (new)      | `PermissionFlags` enum, `FLAG_DISPLAY_NAMES` registry, `ALL_FLAGS`, cache + `loadGuild`, `roleEffectiveFlags`, `memberFlags`, `clearRole`/`clearRoleCascade`, a `setRole(inherit-validating)` writer, and the role-event invalidation hooks |
| `src/lib/permissions.test.ts` (new) | bun test: cycle breaking, dangling parent, additive chains, member OR, owner/admin bypass                                                                                                                                                   |
| `src/command/command.ts`            | `requiredFlags` getter                                                                                                                                                                                                                      |
| `src/command/index.ts`              | middleware check in `InteractionCreate`; wire `Permissions.registerEventListener` invalidation hooks                                                                                                                                        |
| `src/feature/feature-command.ts`    | replace ad-hoc admin check with `requiredFlags = FEATURE_COMMAND`                                                                                                                                                                           |
| `src/command/commands/`             | new `permissions.command.ts` + register in `CommandManager`                                                                                                                                                                                 |
