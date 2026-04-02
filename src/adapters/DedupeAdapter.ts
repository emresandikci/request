import { HttpResponse } from "../core/HttpResponse.ts";
import type { IHttpAdapter } from "./IHttpAdapter.ts";
import type { HttpRequest } from "../core/HttpRequest.ts";

interface InFlightEntry {
  bodyText: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  ok: boolean;
}

export interface DedupeAdapterOptions {
  /**
   * Predicate that decides whether a request should participate in deduplication.
   * Default: deduplicate only `GET` requests.
   */
  shouldDedupe?: (request: HttpRequest<unknown>) => boolean;

  /**
   * Function that produces the deduplication key for a request.
   * Two concurrent requests with the same key share a single in-flight promise.
   * Default: `"${method}:${url}"`.
   */
  keyFn?: (request: HttpRequest<unknown>) => string;
}

const defaultShouldDedupe = (request: HttpRequest<unknown>): boolean =>
  request.method === "GET";

const defaultKeyFn = (request: HttpRequest<unknown>): string =>
  `${request.method}:${request.url}`;

function reconstruct<TRes>(entry: InFlightEntry): HttpResponse<TRes> {
  const raw = new Response(entry.bodyText, {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
  return new HttpResponse<TRes>(raw, entry.ok);
}

/**
 * Decorator adapter that collapses concurrent identical requests into a single
 * in-flight network call. All callers waiting on the same key receive an
 * independently readable {@link HttpResponse} reconstructed from the shared body.
 *
 * Pair with {@link CacheAdapter} (outer) and {@link RetryAdapter} (inner):
 * ```
 * CacheAdapter → DedupeAdapter → RetryAdapter → FetchAdapter
 * ```
 * A cache hit short-circuits before deduplication is even checked; deduplication
 * then prevents N concurrent misses from all hitting the network.
 */
export class DedupeAdapter implements IHttpAdapter {
  private readonly inner: IHttpAdapter;
  private readonly shouldDedupe: (request: HttpRequest<unknown>) => boolean;
  private readonly keyFn: (request: HttpRequest<unknown>) => string;
  private readonly inFlight = new Map<string, Promise<InFlightEntry>>();

  constructor(inner: IHttpAdapter, options?: DedupeAdapterOptions) {
    this.inner = inner;
    this.shouldDedupe = options?.shouldDedupe ?? defaultShouldDedupe;
    this.keyFn = options?.keyFn ?? defaultKeyFn;
  }

  async send<TRes>(request: HttpRequest<unknown>): Promise<HttpResponse<TRes>> {
    if (!this.shouldDedupe(request)) {
      return this.inner.send<TRes>(request);
    }

    const key = this.keyFn(request);

    // Join an already in-flight request instead of firing a new one
    const existing = this.inFlight.get(key);
    if (existing) {
      const entry = await existing;
      return reconstruct<TRes>(entry);
    }

    // First caller — fire the request and normalize to a shareable entry
    const entryPromise: Promise<InFlightEntry> = this.inner
      .send<unknown>(request)
      .then(async (response) => {
        const bodyText = await response.raw.clone().text();
        return {
          bodyText,
          status: response.status,
          statusText: response.statusText,
          headers: { ...response.headers },
          ok: response.ok,
        };
      });

    this.inFlight.set(key, entryPromise);
    // Remove the key when the promise settles (success or failure).
    // Using .then(cb, cb) instead of .finally(cb) avoids an unhandled-rejection on
    // the mirrored promise that .finally() returns when entryPromise rejects.
    void entryPromise.then(
      () => {
        this.inFlight.delete(key);
      },
      () => {
        this.inFlight.delete(key);
      },
    );

    const entry = await entryPromise;
    return reconstruct<TRes>(entry);
  }
}
