import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Rows the mocked `permission_roles` table returns for any guild, plus how
 * many times it was read. The mock ignores the `where` clause, which is fine
 * for these tests: they exercise the cache, not the SQL filter.
 */
const table = {
  rows: [] as Array<{ roleId: string; flags: string; parentRoleId: string | null }>,
  reads: 0,
};

/** A thenable that stands in for a Drizzle write builder. */
function writeResult(): Promise<unknown> & { returning: () => Promise<unknown[]> } {
  const promise = Promise.resolve(undefined) as Promise<unknown> & {
    returning: () => Promise<unknown[]>;
  };
  promise.returning = async () => [];
  return promise;
}

mock.module("../db/index", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          table.reads++;
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

describe("Permissions guild config cache", () => {
  beforeEach(() => {
    table.rows = [];
    table.reads = 0;
    Permissions.invalidateGuild("g1");
    Permissions.invalidateGuild("g2");
  });

  test("reads a guild's rows once, then serves from the cache", async () => {
    table.rows = [{ roleId: "r1", flags: "2", parentRoleId: null }];
    await Permissions.loadGuild("g1");
    await Permissions.loadGuild("g1");
    expect(table.reads).toBe(1);
  });

  test("caches each guild separately", async () => {
    await Permissions.loadGuild("g1");
    await Permissions.loadGuild("g2");
    expect(table.reads).toBe(2);
  });

  test("invalidateGuild forces the next read", async () => {
    await Permissions.loadGuild("g1");
    Permissions.invalidateGuild("g1");
    await Permissions.loadGuild("g1");
    expect(table.reads).toBe(2);
  });

  test("invalidating one guild leaves another cached", async () => {
    await Permissions.loadGuild("g1");
    await Permissions.loadGuild("g2");
    Permissions.invalidateGuild("g1");
    await Permissions.loadGuild("g2");
    expect(table.reads).toBe(2);
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
    expect(table.reads).toBe(1);
    await Permissions.clearRole("g1", "r1");
    table.rows = [];
    const configs = await Permissions.loadGuild("g1");
    expect(table.reads).toBe(2);
    expect(configs.size).toBe(0);
  });

  test("a parent change drops the cached config", async () => {
    table.rows = [{ roleId: "r1", flags: "2", parentRoleId: null }];
    await Permissions.loadGuild("g1");
    await Permissions.setParent("g1", "r1", null);
    await Permissions.loadGuild("g1");
    expect(table.reads).toBeGreaterThan(1);
  });
});
