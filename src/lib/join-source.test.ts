import { describe, expect, test } from "bun:test";
import { emptySnapshot, findJoinSource, type InviteSnapshot, type TrackedInvite } from "./join-source";

function snapshot(options: {
  invites?: Record<string, Partial<TrackedInvite>>;
  vanity?: { code: string; uses: number } | null;
}): InviteSnapshot {
  const invites = new Map<string, TrackedInvite>();
  for (const [code, invite] of Object.entries(options.invites ?? {})) {
    invites.set(code, { uses: invite.uses ?? 0, inviterId: invite.inviterId ?? null });
  }
  return { invites, vanity: options.vanity ?? null };
}

describe("findJoinSource", () => {
  test("names the invite code that gained a use", () => {
    const before = snapshot({
      invites: { abc: { uses: 1, inviterId: "1" }, def: { uses: 4, inviterId: "2" } },
    });
    const after = snapshot({
      invites: { abc: { uses: 1, inviterId: "1" }, def: { uses: 5, inviterId: "2" } },
    });
    expect(findJoinSource(before, after)).toEqual({ kind: "invite", code: "def", inviterId: "2" });
  });

  test("names an invite Discord resolved no inviter for", () => {
    const before = snapshot({ invites: { abc: { uses: 0 } } });
    const after = snapshot({ invites: { abc: { uses: 1 } } });
    expect(findJoinSource(before, after)).toEqual({ kind: "invite", code: "abc", inviterId: null });
  });

  test("names the vanity URL when only that gained a use", () => {
    const before = snapshot({ invites: { abc: { uses: 2 } }, vanity: { code: "shiroko", uses: 7 } });
    const after = snapshot({ invites: { abc: { uses: 2 } }, vanity: { code: "shiroko", uses: 8 } });
    expect(findJoinSource(before, after)).toEqual({ kind: "vanity", code: "shiroko" });
  });

  test("prefers the invite when both it and the vanity URL gained a use", () => {
    const before = snapshot({
      invites: { abc: { uses: 2, inviterId: "1" } },
      vanity: { code: "shiroko", uses: 7 },
    });
    const after = snapshot({
      invites: { abc: { uses: 3, inviterId: "1" } },
      vanity: { code: "shiroko", uses: 8 },
    });
    expect(findJoinSource(before, after)).toEqual({ kind: "invite", code: "abc", inviterId: "1" });
  });

  test("reports nothing when no uses grew", () => {
    const before = snapshot({ invites: { abc: { uses: 2 } }, vanity: { code: "shiroko", uses: 7 } });
    const after = snapshot({ invites: { abc: { uses: 2 } }, vanity: { code: "shiroko", uses: 7 } });
    expect(findJoinSource(before, after)).toBeNull();
  });

  test("reports nothing for a guild with nothing tracked", () => {
    expect(findJoinSource(emptySnapshot(), emptySnapshot())).toBeNull();
  });

  test("ignores a vanity URL seen for the first time", () => {
    const before = snapshot({ invites: { abc: { uses: 0 } } });
    const after = snapshot({ invites: { abc: { uses: 0 } }, vanity: { code: "shiroko", uses: 3 } });
    expect(findJoinSource(before, after)).toBeNull();
  });
});
