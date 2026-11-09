import { describe, expect, test } from "bun:test";
import { PAIR_INTERACTIONS } from "./interactions";
import { SELF_REACTIONS } from "./reactions";

describe("social command surface", () => {
  test("keeps every pair interaction in order", () => {
    expect(PAIR_INTERACTIONS.map(row => row.id)).toEqual([
      "hug",
      "kiss",
      "slap",
      "pat",
      "cuddle",
      "dance",
      "feed",
      "headpat",
      "holdhands",
      "poke",
      "wink",
      "tease",
      "tickle",
      "bonk",
      "blowkiss",
      "bite",
    ]);
  });

  test("keeps every self reaction in order", () => {
    expect(SELF_REACTIONS.map(row => row.id)).toEqual([
      "angry",
      "bleh",
      "blush",
      "bored",
      "confused",
      "cry",
      "happy",
      "laugh",
      "pout",
      "shocked",
      "sleep",
      "smug",
    ]);
  });
});
