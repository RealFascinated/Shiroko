import { describe, expect, test } from "bun:test";
import { youtubePlaceholders } from "./youtube-placeholders";

const CONTEXT = {
  channelName: "Channel Title",
  videoTitle: "Newest",
  videoLink: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
};

describe("youtubePlaceholders", () => {
  test("registers the announcement tokens", () => {
    expect(youtubePlaceholders.placeholders.map(placeholder => placeholder.key)).toEqual([
      "channel_name",
      "video_title",
      "video_link",
    ]);
  });

  test("renders a template against an upload", async () => {
    expect(
      await youtubePlaceholders.replace(CONTEXT, "{channel_name} uploaded {video_title}: {video_link}")
    ).toBe("Channel Title uploaded Newest: https://www.youtube.com/watch?v=aaaaaaaaaaa");
  });

  test("leaves unknown and inherited keys verbatim", async () => {
    expect(await youtubePlaceholders.replace(CONTEXT, "{guild_name} {__proto__} {constructor}")).toBe(
      "{guild_name} {__proto__} {constructor}"
    );
  });

  test("reports tokens nothing resolves, including inherited Object keys", () => {
    const unknown = youtubePlaceholders
      .parse("{channel_name} {guild_name} {__proto__}")
      .filter(token => !youtubePlaceholders.has(token));
    expect(unknown).toEqual(["guild_name", "__proto__"]);
  });
});
