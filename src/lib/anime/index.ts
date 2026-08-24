/**
 * Typed client for the nekos.best API — free, keyless SFW anime images and GIFs.
 *
 * Docs: https://docs.nekos.best/getting-started/api-reference.html
 *
 * Every request must carry a compliant User-Agent (`APP_NAME (CONTACT)`); a
 * default is provided so callers cannot accidentally send a blocked/empty one.
 */

const BASE_URL = "https://nekos.best/api/v2";
const USER_AGENT = "Shiroko (https://github.com/Discord/Shiroko)";

export type Dimensions = { width: number; height: number };

export type AnimeImage = {
  artist_name?: string;
  artist_href?: string;
  source_url?: string;
  url: string;
  dimensions: Dimensions;
};

export type AnimeGif = {
  anime_name?: string;
  url: string;
  dimensions: Dimensions;
};

type NekosResponse<T> = { results: T[] };

export type ImageCategory = "neko" | "waifu" | "husbando" | "kitsune";

export type GifCategory =
  | "angry"
  | "baka"
  | "bite"
  | "bleh"
  | "blowkiss"
  | "blush"
  | "bonk"
  | "bored"
  | "carry"
  | "clap"
  | "confused"
  | "cry"
  | "cuddle"
  | "dance"
  | "facepalm"
  | "feed"
  | "handhold"
  | "handshake"
  | "happy"
  | "highfive"
  | "hug"
  | "kabedon"
  | "kick"
  | "kiss"
  | "lappillow"
  | "laugh"
  | "lurk"
  | "nod"
  | "nom"
  | "nope"
  | "nya"
  | "pat"
  | "peck"
  | "poke"
  | "pout"
  | "punch"
  | "run"
  | "salute"
  | "shake"
  | "shocked"
  | "shoot"
  | "shrug"
  | "sip"
  | "slap"
  | "sleep"
  | "smile"
  | "smug"
  | "spin"
  | "stare"
  | "tableflip"
  | "teehee"
  | "think"
  | "thumbsup"
  | "tickle"
  | "wag"
  | "wave"
  | "wink"
  | "yawn"
  | "yeet";

function clampAmount(amount: number): number {
  return Math.min(20, Math.max(1, Math.floor(amount)));
}

async function fetchResponse<T>(path: string): Promise<NekosResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`nekos.best request failed (${res.status}): ${url}`);
  }
  return res.json() as Promise<NekosResponse<T>>;
}

function first<T>(response: NekosResponse<T>): T {
  const item = response.results[0];
  if (!item) {
    throw new Error("nekos.best returned no results");
  }
  return item;
}

/**
 * Fetch a random image from an image category.
 */
export async function getImage(category: ImageCategory, amount = 1): Promise<AnimeImage> {
  return first(await fetchResponse<AnimeImage>(`/${category}?amount=${clampAmount(amount)}`));
}

/**
 * Fetch a random GIF from a GIF category.
 */
export async function getGif(category: GifCategory, amount = 1): Promise<AnimeGif> {
  return first(await fetchResponse<AnimeGif>(`/${category}?amount=${clampAmount(amount)}`));
}

/**
 * Search images by metadata (artist name, source title, ...).
 */
export async function searchImages(query: string, amount = 1): Promise<AnimeImage> {
  return first(
    await fetchResponse<AnimeImage>(
      `/search?query=${encodeURIComponent(query)}&type=1&amount=${clampAmount(amount)}`
    )
  );
}

/**
 * Search GIFs by metadata (anime name, ...).
 */
export async function searchGifs(query: string, amount = 1): Promise<AnimeGif> {
  return first(
    await fetchResponse<AnimeGif>(
      `/search?query=${encodeURIComponent(query)}&type=2&amount=${clampAmount(amount)}`
    )
  );
}
