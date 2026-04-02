import {
  HttpClient,
  RetryAdapter,
  CacheAdapter,
  DedupeAdapter,
  AdapterResolver,
  BackoffStrategy,
  MemoryCacheStore,
} from '@emstack/request';

/**
 * Adapter stack:
 *   CacheAdapter → DedupeAdapter → RetryAdapter → BrowserFetchAdapter
 *
 * - CacheAdapter:  caches successful GET responses for 60s (LRU, max 50 entries)
 * - DedupeAdapter: collapses concurrent identical in-flight requests into one
 * - RetryAdapter:  retries on NetworkError, TimeoutError, 429, 5xx with exponential backoff
 */
const adapter = new CacheAdapter(
  new DedupeAdapter(
    new RetryAdapter(AdapterResolver.resolve(), {
      maxRetries: 3,
      delay: 300,
      backoff: BackoffStrategy.exponential,
      maxDelay: 10_000,
    }),
  ),
  {
    ttl: 60_000,
    store: new MemoryCacheStore({ maxSize: 50 }),
  },
);

export const api = new HttpClient(
  {
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 8_000,
    hooks: {
      beforeRequest: [
        config => {
          console.debug(`[lite-request] → ${config.method ?? 'GET'} ${config.url}`);
        },
      ],
      afterResponse: [
        (response, config) => {
          console.debug(`[lite-request] ← ${response.status} ${config.url}`);
        },
      ],
      beforeError: [
        (error, config) => {
          console.error(`[lite-request] ✗ ${error.message} (${config.url})`);
        },
      ],
    },
  },
  adapter,
);
