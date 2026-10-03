import { describe, expect, test } from "bun:test";
import type { FeedVideo } from "./youtube-feed";
import { newUploads } from "./youtube-poller";

function video(videoId: string): FeedVideo {
  return { videoId, title: videoId, publishedAt: null };
}

const NEWEST_FIRST = [video("aaa"), video("bbb"), video("ccc"), video("ddd")];

describe("newUploads", () => {
  test("returns entries newer than the last seen id", () => {
    expect(newUploads(NEWEST_FIRST, "ccc").map(item => item.videoId)).toEqual(["aaa", "bbb"]);
  });

  test("returns nothing when the newest entry is already seen", () => {
    expect(newUploads(NEWEST_FIRST, "aaa")).toEqual([]);
  });

  test("is empty on a first poll so a new channel never dumps its back catalogue", () => {
    expect(newUploads(NEWEST_FIRST, null)).toEqual([]);
  });

  test("announces the whole window when the last seen id fell off the feed", () => {
    expect(newUploads(NEWEST_FIRST, "zzz").map(item => item.videoId)).toEqual(["aaa", "bbb", "ccc", "ddd"]);
  });
});
