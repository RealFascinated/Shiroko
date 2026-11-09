import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Guild } from "discord.js";

/**
 * Rows the mocked `permission_roles` table returns for any guild. `fail`
 * makes the store unreachable, so a test can tell a cache hit from a read.
 * `onWrite` runs when a role row is written, standing in for the database
 * applying the write. The mock ignores the `where` clause, which is fine for
 * these tests: they exercise the cache, not the SQL filter.
 */
const table = {
  rows: [] as Array<{ roleId: string; flags: string; parentRoleId: string | null }>,
  fail: false,
  onWrite: undefined as (() => void) | undefined,
};

/** A thenable that stands in for a Drizzle write builder. */
function writeResult(): Promise<unknown> & { returning: () => Promise<unknown[]> } {
  const promise = Promise.resolve(undefined) as Promise<unknown> & {
    returning: () => Promise<unknown[]>;
  };
  promise.returning = async () => [];
  return promise;
}

/** The transaction handle: the row lock reads one row, writes are no-ops. */
const tx = {
  select: () => ({ from: () => ({ where: () => ({ for: async () => table.rows.slice(0, 1) }) }) }),
  insert: () => ({
    values: () => {
      table.onWrite?.();
      return { onConflictDoUpdate: writeResult, returning: async () => [{ id: 1 }] };
    },
  }),
  delete: () => ({ where: writeResult }),
};

mock.module("../db/index", () => ({
  now: {},
  db: {
    transaction: async (run: (handle: typeof tx) => Promise<unknown>) => run(tx),
    select: () => ({
      from: () => ({
        where: async () => {
          if (table.fail) {
            throw new Error("store unreachable");
          }
          return table.rows;
        },
      }),
    }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: writeResult }) }),
    delete: () => ({ where: writeResult }),
    update: () => ({ set: () => ({ where: writeResult }) }),
  },
}));

const { default: Permissions } = await import("./permissions");

const guild = { id: "g1" } as Guild;
const actor = { guild, userId: "u1" };

describe("Permissions guild config cache", () => {
  beforeEach(() => {
    table.rows = [];
    table.fail = false;
    Permissions.invalidateGuild("g1");
    Permissions.invalidateGuild("g2");
  });

  test("a loaded guild is served while the store is unreachable", async () => {
    table.rows = [{ roleId: "r1", flags: "2", parentRoleId: null }];
    await Permissions.loadGuild("g1");
    table.fail = true;
    const configs = await Permissions.loadGuild("g1");
    expect(Permissions.resolveEffective(configs, "r1")).toBe(2n);
  });

  test("invalidateGuild makes the next load return the stored rows", async () => {
    table.rows = [{ roleId: "r1", flags: "2", parentRoleId: null }];
    await Permissions.loadGuild("g1");
    table.rows = [{ roleId: "r1", flags: "8", parentRoleId: null }];
    Permissions.invalidateGuild("g1");
    const configs = await Permissions.loadGuild("g1");
    expect(Permissions.resolveEffective(configs, "r1")).toBe(8n);
  });

  test("invalidating one guild leaves another served from the cache", async () => {
    table.rows = [{ roleId: "r1", flags: "2", parentRoleId: null }];
    await Permissions.loadGuild("g1");
    await Permissions.loadGuild("g2");
    Permissions.invalidateGuild("g1");
    table.fail = true;
    expect(Permissions.resolveEffective(await Permissions.loadGuild("g2"), "r1")).toBe(2n);
    await expect(Permissions.loadGuild("g1")).rejects.toThrow("store unreachable");
  });

  test("resolution reads inheritance from the cached map", async () => {
    table.rows = [
      { roleId: "root", flags: "2", parentRoleId: null },
      { roleId: "leaf", flags: "4", parentRoleId: "root" },
    ];
    const configs = await Permissions.loadGuild("g1");
    expect(Permissions.resolveEffective(configs, "leaf")).toBe(6n);
    expect(Permissions.resolveEffective(configs, "root")).toBe(2n);
    expect(Permissions.resolveEffective(configs, "absent")).toBe(0n);
  });

  test("a write drops the cached config", async () => {
    table.rows = [{ roleId: "r1", flags: "2", parentRoleId: null }];
    await Permissions.loadGuild("g1");
    await Permissions.clearRole(guild, "r1", actor);
    table.rows = [];
    const configs = await Permissions.loadGuild("g1");
    expect(configs.size).toBe(0);
  });

  test("a parent change drops the cached config", async () => {
    table.rows = [{ roleId: "r1", flags: "2", parentRoleId: null }];
    await Permissions.loadGuild("g1");
    table.onWrite = () => {
      table.rows = [
        { roleId: "p", flags: "4", parentRoleId: null },
        { roleId: "r1", flags: "2", parentRoleId: "p" },
      ];
    };
    await Permissions.setParent(guild, "r1", "p", actor);
    const configs = await Permissions.loadGuild("g1");
    expect(Permissions.resolveEffective(configs, "r1")).toBe(6n);
  });
});
