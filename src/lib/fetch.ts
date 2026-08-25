/**
 * Options for {@link fetchJson}.
 */
export interface FetchJsonOptions {
  /** HTTP headers to send. */
  headers?: Bun.HeadersInit;
  /** Base URL to prefix `path` with. */
  baseUrl?: string;
}

/**
 * Fetch a URL (or `baseUrl + path`) and parse the response body as JSON.
 *
 * Throws with the status and full URL when the response is not `ok`, so
 * callers get a debuggable failure without handling HTTP codes themselves.
 *
 * @param path - URL path (or absolute URL when `baseUrl` is omitted).
 * @param options - Optional headers and base URL.
 * @returns The parsed JSON body, typed as `T`.
 */
export async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const url = `${options.baseUrl ?? ""}${path}`;
  const res = await fetch(url, { headers: options.headers });
  if (!res.ok) {
    throw new Error(`request failed (${res.status}): ${url}`);
  }
  return res.json() as Promise<T>;
}
