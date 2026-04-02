import { describe, it, expect, vi, afterEach } from "vitest";
import { CacheAdapter } from "../adapters/CacheAdapter.ts";
import { MemoryCacheStore } from "../adapters/MemoryCacheStore.ts";
import { RetryAdapter } from "../adapters/RetryAdapter.ts";
import { HttpResponse } from "../core/HttpResponse.ts";
import { HttpRequest } from "../core/HttpRequest.ts";
import type { IHttpAdapter } from "../adapters/IHttpAdapter.ts";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(url = "https://api.example.com/data"): HttpRequest {
  return new HttpRequest({ url, method: "GET" });
}

function makePostRequest(url = "https://api.example.com/data"): HttpRequest {
  return new HttpRequest({ url, method: "POST", body: {} });
}

function makeOkResponse(body: string, status = 200): HttpResponse {
  return new HttpResponse(
    new Response(body, {
      status,
      headers: { "content-type": "application/json" },
    }),
    true,
  );
}

function makeErrorResponse(status: number): HttpResponse {
  return new HttpResponse(new Response("err", { status }), false);
}

function singleAdapter(response: HttpResponse): IHttpAdapter {
  return { send: vi.fn().mockResolvedValue(response) };
}

// ─── CacheAdapter ─────────────────────────────────────────────────────────────

describe("CacheAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  // --- cache hit / miss ---
  it("fetches from inner adapter on cache miss", async () => {
    const inner = singleAdapter(makeOkResponse('{"id":1}'));
    const adapter = new CacheAdapter(inner);
    const res = await adapter.send(makeGetRequest());
    expect(inner.send).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });

  it("returns cached result on second request without calling inner adapter", async () => {
    const inner = singleAdapter(makeOkResponse('{"id":1}'));
    const adapter = new CacheAdapter(inner, { ttl: 60_000 });
    const req = makeGetRequest();
    await adapter.send(req);
    await adapter.send(req);
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache POST requests by default", async () => {
    const inner = singleAdapter(makeOkResponse('{"id":2}', 201));
    const adapter = new CacheAdapter(inner);
    await adapter.send(makePostRequest());
    await adapter.send(makePostRequest());
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("does NOT cache failed responses (ok=false)", async () => {
    const inner = { send: vi.fn().mockResolvedValue(makeErrorResponse(500)) };
    const adapter = new CacheAdapter(inner, { ttl: 60_000 });
    const req = makeGetRequest();
    await adapter.send(req);
    await adapter.send(req);
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("custom shouldCache enables caching for POST", async () => {
    const inner = singleAdapter(makeOkResponse("{}", 201));
    const adapter = new CacheAdapter(inner, {
      ttl: 60_000,
      shouldCache: () => true,
    });
    await adapter.send(makePostRequest());
    await adapter.send(makePostRequest());
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  // --- cache key ---
  it("default keyFn differentiates by URL", async () => {
    const inner = singleAdapter(makeOkResponse("{}"));
    const adapter = new CacheAdapter(inner, { ttl: 60_000 });
    await adapter.send(makeGetRequest("https://api.example.com/users"));
    await adapter.send(makeGetRequest("https://api.example.com/posts"));
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("custom keyFn is used for cache lookup", async () => {
    const inner = singleAdapter(makeOkResponse("{}"));
    const adapter = new CacheAdapter(inner, {
      ttl: 60_000,
      keyFn: () => "constant-key", // all requests map to same key
    });
    await adapter.send(makeGetRequest("https://api.example.com/users"));
    await adapter.send(makeGetRequest("https://api.example.com/posts"));
    // Different URLs but same custom key → second is a cache hit
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  // --- TTL and expiry ---
  it("expired entry is evicted and inner adapter is called again", async () => {
    vi.useFakeTimers();
    const inner = singleAdapter(makeOkResponse("{}"));
    const adapter = new CacheAdapter(inner, { ttl: 1_000 });
    const req = makeGetRequest();
    await adapter.send(req);
    expect(inner.send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_001); // past TTL
    await adapter.send(req);
    expect(inner.send).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("non-expired entry is returned from cache before TTL", async () => {
    vi.useFakeTimers();
    const inner = singleAdapter(makeOkResponse("{}"));
    const adapter = new CacheAdapter(inner, { ttl: 5_000 });
    const req = makeGetRequest();
    await adapter.send(req);
    vi.advanceTimersByTime(4_999); // just before expiry
    await adapter.send(req);
    expect(inner.send).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // --- stream safety ---
  it("cached response body is readable via .json() on cache hit", async () => {
    const body = { id: 42, name: "Alice" };
    const inner = singleAdapter(makeOkResponse(JSON.stringify(body)));
    const adapter = new CacheAdapter(inner, { ttl: 60_000 });
    const req = makeGetRequest();

    await adapter.send(req); // prime cache

    const cached = await adapter.send(req);
    const data = (await cached.json()) as typeof body;
    expect(data).toEqual(body);
  });

  it("original response body is still consumable by the caller after caching", async () => {
    const body = { id: 7 };
    const inner = singleAdapter(makeOkResponse(JSON.stringify(body)));
    const adapter = new CacheAdapter(inner, { ttl: 60_000 });

    // First call: cache miss — original response returned, body must still be readable
    const original = await adapter.send(makeGetRequest());
    const data = (await original.json()) as typeof body;
    expect(data).toEqual(body);
  });

  it("reconstructed response has correct status and headers from cache", async () => {
    const inner = singleAdapter(
      new HttpResponse(
        new Response("{}", {
          status: 200,
          headers: { "x-custom": "yes", "content-type": "application/json" },
        }),
        true,
      ),
    );
    const adapter = new CacheAdapter(inner, { ttl: 60_000 });
    const req = makeGetRequest();
    await adapter.send(req); // prime cache
    const cached = await adapter.send(req);

    expect(cached.status).toBe(200);
    expect(cached.headers["x-custom"]).toBe("yes");
  });

  // --- custom store ---
  it("uses the provided custom ICacheStore", async () => {
    const store = new MemoryCacheStore();
    const inner = singleAdapter(makeOkResponse("{}"));
    const adapter = new CacheAdapter(inner, { store, ttl: 60_000 });
    const req = makeGetRequest();
    await adapter.send(req);
    expect(store.size).toBe(1);
    await adapter.send(req);
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  // --- composition with RetryAdapter ---
  it("cache hit short-circuits before the inner RetryAdapter fires", async () => {
    const innerMock: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse('{"data":true}')),
    };
    const retryAdapter = new RetryAdapter(innerMock, {
      maxRetries: 3,
      delay: 0,
    });
    const cacheAdapter = new CacheAdapter(retryAdapter, { ttl: 60_000 });

    const req = makeGetRequest();
    await cacheAdapter.send(req); // miss → calls through to innerMock
    await cacheAdapter.send(req); // hit → innerMock NOT called again

    expect(innerMock.send).toHaveBeenCalledTimes(1);
  });
});

// ─── MemoryCacheStore ─────────────────────────────────────────────────────────

describe("MemoryCacheStore", () => {
  function makeEntry(
    bodyText = "{}",
    ttlMs = 60_000,
  ): import("../adapters/ICacheStore.ts").CacheEntry {
    return {
      bodyText,
      status: 200,
      statusText: "OK",
      headers: {},
      expiresAt: Date.now() + ttlMs,
    };
  }

  it("stores and retrieves an entry", () => {
    const store = new MemoryCacheStore();
    store.set("k", makeEntry());
    expect(store.get("k")).toBeDefined();
    expect(store.size).toBe(1);
  });

  it("returns undefined for a missing key", () => {
    expect(new MemoryCacheStore().get("nope")).toBeUndefined();
  });

  it("evicts and returns undefined for an expired entry", () => {
    vi.useFakeTimers();
    const store = new MemoryCacheStore();
    store.set("k", makeEntry("{}", 100));
    vi.advanceTimersByTime(101);
    expect(store.get("k")).toBeUndefined();
    expect(store.size).toBe(0);
    vi.useRealTimers();
  });

  it("evicts the LRU entry when maxSize is reached", () => {
    const store = new MemoryCacheStore({ maxSize: 2 });
    store.set("a", makeEntry());
    store.set("b", makeEntry());
    // Access 'a' to make it recently used
    store.get("a");
    // Now 'b' is LRU; adding 'c' should evict 'b'
    store.set("c", makeEntry());
    expect(store.size).toBe(2);
    expect(store.get("b")).toBeUndefined();
    expect(store.get("a")).toBeDefined();
    expect(store.get("c")).toBeDefined();
  });

  it("updating an existing key does not increase size", () => {
    const store = new MemoryCacheStore({ maxSize: 2 });
    store.set("k", makeEntry("v1"));
    store.set("k", makeEntry("v2"));
    expect(store.size).toBe(1);
    expect(store.get("k")?.bodyText).toBe("v2");
  });

  it("delete() removes a specific entry", () => {
    const store = new MemoryCacheStore();
    store.set("k", makeEntry());
    store.delete("k");
    expect(store.get("k")).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("delete() is a no-op for unknown keys", () => {
    const store = new MemoryCacheStore();
    expect(() => store.delete("ghost")).not.toThrow();
  });

  it("clear() removes all entries", () => {
    const store = new MemoryCacheStore();
    store.set("a", makeEntry());
    store.set("b", makeEntry());
    store.clear();
    expect(store.size).toBe(0);
    expect(store.get("a")).toBeUndefined();
  });
});
