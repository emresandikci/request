import type { CacheEntry, ICacheStore } from "./ICacheStore.ts";

export interface MemoryCacheStoreOptions {
  /**
   * Maximum number of entries before the least-recently-used entry is evicted.
   * @default 500
   */
  maxSize?: number;
}

/**
 * In-memory LRU cache store backed by a `Map`.
 * TTL is enforced lazily on `get()` — stale entries are evicted when accessed.
 */
export class MemoryCacheStore implements ICacheStore {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxSize: number;

  constructor(options?: MemoryCacheStoreOptions) {
    this.maxSize = options?.maxSize ?? 500;
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // LRU refresh: delete + re-insert moves the entry to the Map's iteration tail
    this.store.delete(key);
    this.store.set(key, entry);
    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    if (this.store.has(key)) {
      // Update in place — delete first so the re-insert goes to the tail
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // Evict the least-recently-used entry (Map iteration is insertion-order)
      const lruKey = this.store.keys().next().value;
      if (lruKey !== undefined) this.store.delete(lruKey);
    }
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Number of entries currently in the store. */
  get size(): number {
    return this.store.size;
  }
}
