import { describe, expect, test } from "bun:test";
import { joinSourceLines } from "./member-log";

describe("joinSourceLines", () => {
  test("names the invite and the member whose invite it is", () => {
    expect(joinSourceLines({ kind: "invite", code: "abc123", inviterId: "100000000000000001" })).toEqual([
      "**➜** Invite: `abc123` by <@100000000000000001>",
    ]);
  });

  test("names an invite whose inviter Discord did not resolve", () => {
    expect(joinSourceLines({ kind: "invite", code: "abc123", inviterId: null })).toEqual([
      "**➜** Invite: `abc123`",
    ]);
  });

  test("names the vanity URL", () => {
    expect(joinSourceLines({ kind: "vanity", code: "shiroko" })).toEqual(["**➜** Vanity URL: `shiroko`"]);
  });

  test("falls back to unknown when nothing gained a use", () => {
    expect(joinSourceLines(null)).toEqual(["**➜** Invite: Unknown"]);
  });
});
