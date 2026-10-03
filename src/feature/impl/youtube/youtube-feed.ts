import { TimeUnit } from "@/lib/time";

const USER_AGENT = "Mozilla/5.0 (compatible; Shiroko/1.0; +https://github.com/RealFascinated/Shiroko)";
const FEED_URL = "https://www.youtube.com/feeds/videos.xml";
const REQUEST_TIMEOUT_MS = TimeUnit.toMillis(TimeUnit.Second, 15);

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const EXTERNAL_ID = /"externalId":"(UC[A-Za-z0-9_-]{22})"/;

export interface FeedVideo {
  videoId: string;
  title: string;
  publishedAt: Date | null;
}

export interface ParsedFeed {
  channelName: string;
  videos: FeedVideo[];
}

export interface FeedValidators {
  etag?: string | null;
  lastModified?: string | null;
}

export interface FeedResult {
  notModified: boolean;
  parsed?: ParsedFeed;
  etag?: string | null;
  lastModified?: string | null;
}

/**
 * Resolve a `UC...` id, a `/channel/UC...` URL, an `@handle`, or a channel
 * URL to a channel id. Returns null when the input carries no channel.
 *
 * A raw id is returned without a request; a handle needs the channel page,
 * whose embedded `externalId` is the same id the feed is keyed by.
 */
export async function resolveYoutubeChannel(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (CHANNEL_ID.test(trimmed)) {
    return trimmed;
  }

  const fromUrl = channelIdFromUrl(trimmed);
  if (fromUrl) {
    return fromUrl;
  }

  const handle = handleFromInput(trimmed);
  if (!handle) {
    return null;
  }
  const res = await fetch(`https://www.youtube.com/${handle}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    return null;
  }
  const match = EXTERNAL_ID.exec(await res.text());
  return match?.[1] ?? null;
}

/**
 * Fetch and parse a channel's Atom feed, sending the previous response's
 * validators so an unchanged feed answers `304` instead of resending the
 * body. Throws on any non-`2xx` (besides `304`), including the `404` an
 * IP-blocked host sees.
 */
export async function fetchYoutubeFeed(
  channelId: string,
  validators: FeedValidators = {}
): Promise<FeedResult> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (validators.etag) {
    headers["If-None-Match"] = validators.etag;
  }
  if (validators.lastModified) {
    headers["If-Modified-Since"] = validators.lastModified;
  }
  const res = await fetch(`${FEED_URL}?channel_id=${encodeURIComponent(channelId)}`, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 304) {
    return { notModified: true };
  }
  if (!res.ok) {
    throw new Error(`feed for ${channelId} failed (${res.status})`);
  }
  return {
    notModified: false,
    parsed: parseYoutubeFeed(await res.text()),
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}

/**
 * Parse a videos feed into its channel name and entries, newest first. The
 * feed lists entries newest first, and that order is what lets the poller
 * stop at the last id it announced.
 *
 * Uses Bun's built-in XML parser; a malformed document throws `SyntaxError`,
 * which the poller isolates per channel.
 */
export function parseYoutubeFeed(xml: string): ParsedFeed {
  const feed = Bun.XML.parse(xml)["feed"];
  if (feed === undefined || typeof feed === "string") {
    return { channelName: "", videos: [] };
  }
  const author = field(feed, "author");
  const channelName = text(field(author, "name")) ?? text(field(feed, "title")) ?? "";
  const videos = asArray(feed["entry"]).flatMap(entry => {
    const videoId = text(field(entry, "yt:videoId"));
    const title = text(field(entry, "title"));
    if (!videoId || title === null) {
      return [];
    }
    return [{ videoId, title, publishedAt: date(text(field(entry, "published"))) }];
  });
  return { channelName, videos };
}

function channelIdFromUrl(input: string): string | null {
  const url = parseYoutubeUrl(input);
  if (!url) {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "channel" && parts[1] && CHANNEL_ID.test(parts[1])) {
    return parts[1];
  }
  return null;
}

function handleFromInput(input: string): string | null {
  if (input.startsWith("@")) {
    return input;
  }
  const url = parseYoutubeUrl(input);
  if (!url) {
    return null;
  }
  const handle = url.pathname.split("/").filter(Boolean)[0];
  return handle?.startsWith("@") ? handle : null;
}

function parseYoutubeUrl(input: string): URL | null {
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    return /(^|\.)youtube\.com$/.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/**
 * Read one child of a compact {@link Bun.XML.Element}. The parser puts
 * attributes under `@name` and text under `#text`; a childless, attribute-less
 * element is a bare string, so this returns undefined for those.
 */
function field(source: unknown, key: string): unknown {
  return source && typeof source === "object" && !Array.isArray(source)
    ? (source as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Read an element's text, trimming the feed's formatting whitespace. Handles
 * the compact shape's three cases: a bare string, an array of them, or an
 * element whose text sits under `#text` because it also has attributes.
 */
function text(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? text(value[0]) : null;
  }
  const inner = field(value, "#text");
  return typeof inner === "string" ? inner.trim() : null;
}

/** One child, or many; the compact shape uses a bare value for a single occurrence. */
function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function date(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
