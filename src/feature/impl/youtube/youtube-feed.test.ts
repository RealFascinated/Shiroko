import { describe, expect, test } from "bun:test";
import { parseYoutubeFeed, resolveYoutubeChannel } from "./youtube-feed";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <title>Channel Title</title>
  <author>
    <name>
      Channel Title
    </name>
    <uri>https://www.youtube.com/channel/UCBR8-60-B28hp2BmDPdntcQ</uri>
  </author>
  <entry>
    <id>yt:video:aaaaaaaaaaa</id>
    <yt:videoId>aaaaaaaaaaa</yt:videoId>
    <title>Newest</title>
    <published>2026-01-02T03:04:05+00:00</published>
  </entry>
  <entry>
    <id>yt:video:bbbbbbbbbbb</id>
    <yt:videoId>bbbbbbbbbbb</yt:videoId>
    <title type="text">Older</title>
    <published>2026-01-01T00:00:00+00:00</published>
  </entry>
</feed>`;

describe("parseYoutubeFeed", () => {
  test("reads the channel name and newest-first entries", () => {
    const parsed = parseYoutubeFeed(FEED);
    expect(parsed.channelName).toBe("Channel Title");
    expect(parsed.videos.map(video => video.videoId)).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb"]);
    expect(parsed.videos.map(video => video.title)).toEqual(["Newest", "Older"]);
    expect(parsed.videos[0]!.publishedAt?.toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });

  test("trims formatting whitespace and reads a title that carries an attribute", () => {
    const parsed = parseYoutubeFeed(FEED);
    // The author name spans lines in the fixture; the second title has a type
    // attribute, so its text sits under "#text" in Bun's compact shape.
    expect(parsed.channelName).toBe("Channel Title");
    expect(parsed.videos[1]!.title).toBe("Older");
  });

  test("treats a single entry as one video, not a missing list", () => {
    const single = `<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <author><name>Solo</name></author>
  <entry><yt:videoId>aaaaaaaaaaa</yt:videoId><title>Only</title></entry>
</feed>`;
    const parsed = parseYoutubeFeed(single);
    expect(parsed.channelName).toBe("Solo");
    expect(parsed.videos.map(video => video.videoId)).toEqual(["aaaaaaaaaaa"]);
  });

  test("returns nothing for a body that is not a feed", () => {
    expect(parseYoutubeFeed("<html></html>")).toEqual({ channelName: "", videos: [] });
  });
});

describe("resolveYoutubeChannel", () => {
  test("accepts a raw channel id without a request", async () => {
    expect(await resolveYoutubeChannel("UCBR8-60-B28hp2BmDPdntcQ")).toBe("UCBR8-60-B28hp2BmDPdntcQ");
  });

  test("reads the id out of a channel URL", async () => {
    expect(
      await resolveYoutubeChannel("https://www.youtube.com/channel/UCBR8-60-B28hp2BmDPdntcQ/videos")
    ).toBe("UCBR8-60-B28hp2BmDPdntcQ");
  });

  test("rejects input that carries no channel", async () => {
    expect(await resolveYoutubeChannel("not a channel")).toBeNull();
    expect(await resolveYoutubeChannel("https://example.com/channel/UCBR8-60-B28hp2BmDPdntcQ")).toBeNull();
  });
});
