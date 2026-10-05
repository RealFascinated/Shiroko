import { describe, expect, test } from "bun:test";
import { booleanFields } from "./descriptors";

describe("booleanFields", () => {
  test("emits one boolean descriptor per key, with labels and defaults", () => {
    const fields = booleanFields({ message: "Message", voice: "Voice" }, { message: true, voice: false });
    expect(fields).toEqual([
      { key: "message", type: "boolean", label: "Message", default: true },
      { key: "voice", type: "boolean", label: "Voice", default: false },
    ]);
  });
});
