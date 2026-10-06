/**
 * Typed client for the nekos.best API. Free, keyless SFW anime images and GIFs.
 *
 * Docs: https://docs.nekos.best/getting-started/api-reference.html
 *
 * Every request must carry a compliant User-Agent (`APP_NAME (CONTACT)`); a
 * default is provided so callers cannot accidentally send a blocked/empty one.
 */

import { fetchJson } from "../fetch";
import { clamp } from "../math";
import { first } from "../utils";

const BASE_URL = "https://nekos.best/api/v2";
const USER_AGENT = "Arona (https://github.com/Discord/Shiroko)";

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
  return Math.floor(clamp(amount, 1, 20));
}

async function fetchResponse<T>(path: string): Promise<NekosResponse<T>> {
  return fetchJson<NekosResponse<T>>(path, {
    baseUrl: BASE_URL,
    headers: { "User-Agent": USER_AGENT },
  });
}

/**
 * @param amount - Number of images to request (clamped to 1-20); only the first is returned.
 */
export async function getImage(category: ImageCategory, amount = 1): Promise<AnimeImage> {
  return first((await fetchResponse<AnimeImage>(`/${category}?amount=${clampAmount(amount)}`)).results);
}

/**
 * @param amount - Number of GIFs to request (clamped to 1-20); only the first is returned.
 */
export async function getGif(category: GifCategory, amount = 1): Promise<AnimeGif> {
  return first((await fetchResponse<AnimeGif>(`/${category}?amount=${clampAmount(amount)}`)).results);
}

/**
 * Search images by metadata (artist name, source title, ...).
 *
 * @param amount - Number of images to request (clamped to 1-20); only the first is returned.
 */
export async function searchImages(query: string, amount = 1): Promise<AnimeImage> {
  return first(
    (
      await fetchResponse<AnimeImage>(
        `/search?query=${encodeURIComponent(query)}&type=1&amount=${clampAmount(amount)}`
      )
    ).results
  );
}

/**
 * Search GIFs by metadata (anime name, ...).
 *
 * @param amount - Number of GIFs to request (clamped to 1-20); only the first is returned.
 */
export async function searchGifs(query: string, amount = 1): Promise<AnimeGif> {
  return first(
    (
      await fetchResponse<AnimeGif>(
        `/search?query=${encodeURIComponent(query)}&type=2&amount=${clampAmount(amount)}`
      )
    ).results
  );
}
