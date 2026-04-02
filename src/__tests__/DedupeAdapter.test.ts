import { describe, it, expect, vi, afterEach } from "vitest";
import { DedupeAdapter } from "../adapters/DedupeAdapter.ts";
import { HttpResponse } from "../core/HttpResponse.ts";
import { HttpRequest } from "../core/HttpRequest.ts";
import { NetworkError } from "../errors/NetworkError.ts";
import type { IHttpAdapter } from "../adapters/IHttpAdapter.ts";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(url = "https://api.example.com/data"): HttpRequest {
  return new HttpRequest({ url, method: "GET" });
}

function makePostRequest(url = "https://api.example.com/data"): HttpRequest {
  return new HttpRequest({ url, method: "POST", body: {} });
}

function makeOkResponse(body = "{}"): HttpResponse {
  return new HttpResponse(
    new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    true,
  );
}

/** Adapter whose `send` resolves only after `resolve()` is called externally. */
function deferredAdapter(): {
  adapter: IHttpAdapter;
  resolve: (r: HttpResponse) => void;
  reject: (e: unknown) => void;
  callCount: () => number;
} {
  let callCount = 0;
  let resolveFn!: (r: HttpResponse) => void;
  let rejectFn!: (e: unknown) => void;

  const adapter: IHttpAdapter = {
    send: vi.fn().mockImplementation(() => {
      callCount++;
      return new Promise<HttpResponse>((res, rej) => {
        resolveFn = res;
        rejectFn = rej;
      });
    }),
  };

  return {
    adapter,
    resolve: (r) => resolveFn(r),
    reject: (e) => rejectFn(e),
    callCount: () => callCount,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("DedupeAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  // --- basic passthrough ---
  it("passes through to the inner adapter on a single request", async () => {
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse()),
    };
    const adapter = new DedupeAdapter(inner);
    const res = await adapter.send(makeGetRequest());
    expect(inner.send).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });

  it("response body is readable after deduplication (single caller)", async () => {
    const body = { id: 1 };
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse(JSON.stringify(body))),
    };
    const adapter = new DedupeAdapter(inner);
    const res = await adapter.send(makeGetRequest());
    expect(await res.json()).toEqual(body);
  });

  // --- concurrent deduplication ---
  it("fires only one inner request for N concurrent identical requests", async () => {
    const deferred = deferredAdapter();
    const adapter = new DedupeAdapter(deferred.adapter);
    const req = makeGetRequest();

    const p1 = adapter.send(req);
    const p2 = adapter.send(req);
    const p3 = adapter.send(req);

    // All three are pending — inner was called exactly once
    expect(deferred.callCount()).toBe(1);

    deferred.resolve(makeOkResponse('{"v":1}'));
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
    expect(deferred.callCount()).toBe(1); // still just one
  });

  it("each concurrent caller gets an independently readable response body", async () => {
    const body = { msg: "hello" };
    const deferred = deferredAdapter();
    const adapter = new DedupeAdapter(deferred.adapter);
    const req = makeGetRequest();

    const p1 = adapter.send(req);
    const p2 = adapter.send(req);

    deferred.resolve(makeOkResponse(JSON.stringify(body)));
    const [r1, r2] = await Promise.all([p1, p2]);

    // Both callers can read the body — streams are independent
    expect(await r1.json()).toEqual(body);
    expect(await r2.json()).toEqual(body);
  });

  it("reconstructed responses preserve status and headers", async () => {
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(
        new HttpResponse(
          new Response("{}", {
            status: 200,
            headers: {
              "x-request-id": "abc123",
              "content-type": "application/json",
            },
          }),
          true,
        ),
      ),
    };
    const adapter = new DedupeAdapter(inner);
    const req = makeGetRequest();

    const p1 = adapter.send(req);
    const p2 = adapter.send(req);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe(200);
    expect(r1.headers["x-request-id"]).toBe("abc123");
    expect(r2.status).toBe(200);
    expect(r2.headers["x-request-id"]).toBe("abc123");
  });

  // --- sequential requests ---
  it("sequential requests each go through to the inner adapter", async () => {
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse()),
    };
    const adapter = new DedupeAdapter(inner);
    const req = makeGetRequest();

    await adapter.send(req);
    await adapter.send(req);

    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  // --- key differentiation ---
  it("concurrent requests to different URLs are NOT deduplicated", async () => {
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse()),
    };
    const adapter = new DedupeAdapter(inner);

    const p1 = adapter.send(makeGetRequest("https://api.example.com/users"));
    const p2 = adapter.send(makeGetRequest("https://api.example.com/posts"));
    await Promise.all([p1, p2]);

    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  // --- non-GET passthrough ---
  it("does NOT deduplicate POST requests by default", async () => {
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse()),
    };
    const adapter = new DedupeAdapter(inner);
    const req = makePostRequest();

    const p1 = adapter.send(req);
    const p2 = adapter.send(req);
    await Promise.all([p1, p2]);

    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  // --- error propagation ---
  it("all concurrent callers receive the error when the in-flight request fails", async () => {
    const deferred = deferredAdapter();
    const adapter = new DedupeAdapter(deferred.adapter);
    const req = makeGetRequest();

    const p1 = adapter.send(req);
    const p2 = adapter.send(req);

    const err = new NetworkError("DNS fail", {});
    deferred.reject(err);

    await expect(p1).rejects.toBe(err);
    await expect(p2).rejects.toBe(err);
    expect(deferred.callCount()).toBe(1);
  });

  it("clears in-flight entry after failure so next request goes through", async () => {
    const deferred = deferredAdapter();
    const adapter = new DedupeAdapter(deferred.adapter);
    const req = makeGetRequest();

    const p1 = adapter.send(req);
    deferred.reject(new NetworkError("fail", {}));
    await expect(p1).rejects.toBeInstanceOf(NetworkError);

    // Next request should fire a new inner call
    const inner2: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse()),
    };
    const adapter2 = new DedupeAdapter(inner2);
    await adapter2.send(req);
    expect(inner2.send).toHaveBeenCalledTimes(1);
  });

  // --- custom options ---
  it("custom shouldDedupe can enable deduplication for POST", async () => {
    const deferred = deferredAdapter();
    const adapter = new DedupeAdapter(deferred.adapter, {
      shouldDedupe: () => true,
    });
    const req = makePostRequest();

    const p1 = adapter.send(req);
    const p2 = adapter.send(req);

    deferred.resolve(makeOkResponse());
    await Promise.all([p1, p2]);

    expect(deferred.callCount()).toBe(1);
  });

  it("custom keyFn controls which requests are considered identical", async () => {
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse()),
    };
    const adapter = new DedupeAdapter(inner, {
      keyFn: () => "same-key", // all requests collapse to one key
    });

    const p1 = adapter.send(makeGetRequest("https://api.example.com/a"));
    const p2 = adapter.send(makeGetRequest("https://api.example.com/b"));
    await Promise.all([p1, p2]);

    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it("custom keyFn with distinct keys does NOT deduplicate", async () => {
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(makeOkResponse()),
    };
    const adapter = new DedupeAdapter(inner, {
      keyFn: (req) => req.url, // unique per URL (same as default minus method prefix)
    });

    const p1 = adapter.send(makeGetRequest("https://api.example.com/a"));
    const p2 = adapter.send(makeGetRequest("https://api.example.com/b"));
    await Promise.all([p1, p2]);

    expect(inner.send).toHaveBeenCalledTimes(2);
  });
});
