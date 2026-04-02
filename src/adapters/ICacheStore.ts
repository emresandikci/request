export interface CacheEntry {
  /** Serialised response body */
  bodyText: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  /** Unix timestamp (ms) after which the entry is considered stale */
  expiresAt: number;
}

export interface ICacheStore {
  /**
   * Return the cached entry for `key`, or `undefined` if missing or expired.
   * Implementations are expected to handle TTL enforcement internally.
   */
  get(key: string): CacheEntry | undefined;

  /** Store an entry. Any previous value for `key` is overwritten. */
  set(key: string, entry: CacheEntry): void;

  /** Remove a single entry. No-op if the key does not exist. */
  delete(key: string): void;

  /** Remove all cached entries. */
  clear(): void;
}
