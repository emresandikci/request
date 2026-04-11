import { HttpResponse } from "../core/HttpResponse.ts";
import { MemoryCacheStore } from "./MemoryCacheStore.ts";
import type { ICacheStore } from "./ICacheStore.ts";
import type { IHttpAdapter } from "./IHttpAdapter.ts";
import type { HttpRequest } from "../core/HttpRequest.ts";

export interface CacheAdapterOptions {
  /**
   * Backing cache store. Defaults to a new {@link MemoryCacheStore} with
   * default options (max 500 entries, LRU eviction).
   */
  store?: ICacheStore;

  /**
   * Time-to-live in milliseconds for cached entries.
   * @default 60_000
   */
  ttl?: number;

  /**
   * Predicate that decides whether a request's response should be cached.
   * Default: cache only `GET` requests.
   */
  shouldCache?: (request: HttpRequest<unknown>) => boolean;

  /**
   * Function that produces the cache key for a request.
   * Default: `"${method}:${url}"`.
   */
  keyFn?: (request: HttpRequest<unknown>) => string;
}

const defaultShouldCache = (request: HttpRequest<unknown>): boolean =>
  request.method === "GET";

const defaultKeyFn = (request: HttpRequest<unknown>): string =>
  `${request.method}:${request.url}`;

function allowsCachingByHeaders(
  headers: Readonly<Record<string, string>>,
): boolean {
  const cacheControl = headers["cache-control"]?.toLowerCase() ?? "";
  if (
    cacheControl.includes("no-store") ||
    cacheControl.includes("no-cache") ||
    cacheControl.includes("private")
  ) {
    return false;
  }

  const pragma = headers["pragma"]?.toLowerCase() ?? "";
  if (pragma.includes("no-cache")) {
    return false;
  }

  return true;
}

/**
 * Decorator adapter that wraps any {@link IHttpAdapter} and caches successful
 * responses in a pluggable {@link ICacheStore}.
 *
 * Only responses where `response.ok === true` are stored. The native
 * `Response` body stream is cloned before reading to keep the original
 * response fully consumable by the caller.
 *
 * @example
 * ```typescript
 * const client = new HttpClient(
 *   { baseURL: 'https://api.example.com' },
 *   new CacheAdapter(
 *     new RetryAdapter(AdapterResolver.resolve()),
 *     { ttl: 5 * 60_000 }, // 5-minute cache
 *   ),
 * );
 * ```
 */
export class CacheAdapter implements IHttpAdapter {
  private readonly inner: IHttpAdapter;
  private readonly store: ICacheStore;
  private readonly ttl: number;
  private readonly shouldCache: (request: HttpRequest<unknown>) => boolean;
  private readonly keyFn: (request: HttpRequest<unknown>) => string;

  constructor(inner: IHttpAdapter, options?: CacheAdapterOptions) {
    this.inner = inner;
    this.store = options?.store ?? new MemoryCacheStore();
    this.ttl = options?.ttl ?? 60_000;
    this.shouldCache = options?.shouldCache ?? defaultShouldCache;
    this.keyFn = options?.keyFn ?? defaultKeyFn;
  }

  async send<TRes>(request: HttpRequest<unknown>): Promise<HttpResponse<TRes>> {
    if (!this.shouldCache(request)) {
      return this.inner.send<TRes>(request);
    }

    const key = this.keyFn(request);

    // --- Cache hit ---
    const cached = this.store.get(key);
    if (cached) {
      const synthetic = new Response(cached.bodyText, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
      });
      return new HttpResponse<TRes>(synthetic, true);
    }

    // --- Cache miss: fetch and conditionally store ---
    const response = await this.inner.send<TRes>(request);

    if (response.ok && allowsCachingByHeaders(response.headers)) {
      // Clone before reading so the original stream remains consumable by the caller
      const bodyText = await response.raw.clone().text();
      this.store.set(key, {
        bodyText,
        status: response.status,
        statusText: response.statusText,
        headers: { ...response.headers },
        expiresAt: Date.now() + this.ttl,
      });
    }

    return response;
  }
}
