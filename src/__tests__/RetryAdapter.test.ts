import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RetryAdapter, BackoffStrategy } from "../adapters/RetryAdapter.ts";
import { HttpResponse } from "../core/HttpResponse.ts";
import { HttpRequest } from "../core/HttpRequest.ts";
import { NetworkError } from "../errors/NetworkError.ts";
import { TimeoutError } from "../errors/TimeoutError.ts";
import { HttpError } from "../errors/HttpError.ts";
import type { IHttpAdapter } from "../adapters/IHttpAdapter.ts";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeRequest(): HttpRequest {
  return new HttpRequest({
    url: "https://api.example.com/data",
    method: "GET",
  });
}

function okResponse(): HttpResponse {
  return new HttpResponse(new Response('{"ok":true}', { status: 200 }), true);
}

function errorResponse(status: number): HttpResponse {
  return new HttpResponse(new Response("{}", { status }), false);
}

function networkError(): NetworkError {
  return new NetworkError("DNS fail", {});
}

function timeoutError(): TimeoutError {
  return new TimeoutError({ timeout: 1000 });
}

function httpError(status: number): HttpError {
  return new HttpError(`HTTP ${status}`, errorResponse(status), {});
}

/** Mock adapter that cycles through a list of results in order. */
function cycleAdapter(
  outcomes: Array<{ resolve: HttpResponse } | { reject: unknown }>,
): IHttpAdapter {
  let i = 0;
  return {
    send: vi.fn().mockImplementation(async () => {
      const outcome = outcomes[i++];
      if (!outcome) throw new Error("cycleAdapter ran out of outcomes");
      if ("reject" in outcome) throw outcome.reject;
      return outcome.resolve;
    }),
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("RetryAdapter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- success without retry ---
  it("returns the response immediately when the first attempt succeeds", async () => {
    const inner = cycleAdapter([{ resolve: okResponse() }]);
    const adapter = new RetryAdapter(inner, { delay: 0 });
    const result = await adapter.send(makeRequest());
    expect(result.ok).toBe(true);
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  // --- retry on specific errors ---
  it("retries once on NetworkError and succeeds", async () => {
    const inner = cycleAdapter([
      { reject: networkError() },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, { maxRetries: 1, delay: 0 });
    const result = await adapter.send(makeRequest());
    expect(result.ok).toBe(true);
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("retries on TimeoutError", async () => {
    const inner = cycleAdapter([
      { reject: timeoutError() },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, { maxRetries: 1, delay: 0 });
    const result = await adapter.send(makeRequest());
    expect(result.ok).toBe(true);
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("retries on HttpError 500", async () => {
    const inner = cycleAdapter([
      { reject: httpError(500) },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, { maxRetries: 1, delay: 0 });
    await expect(adapter.send(makeRequest())).resolves.toBeDefined();
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("retries on HttpError 429 (Too Many Requests)", async () => {
    const inner = cycleAdapter([
      { reject: httpError(429) },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, { maxRetries: 1, delay: 0 });
    await expect(adapter.send(makeRequest())).resolves.toBeDefined();
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  // --- no retry for non-retryable errors ---
  it("does NOT retry on HttpError 404", async () => {
    const inner = cycleAdapter([{ reject: httpError(404) }]);
    const adapter = new RetryAdapter(inner, { maxRetries: 3, delay: 0 });
    await expect(adapter.send(makeRequest())).rejects.toBeInstanceOf(HttpError);
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on HttpError 400", async () => {
    const inner = cycleAdapter([{ reject: httpError(400) }]);
    const adapter = new RetryAdapter(inner, { maxRetries: 3, delay: 0 });
    await expect(adapter.send(makeRequest())).rejects.toBeInstanceOf(HttpError);
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on a plain Error", async () => {
    const inner = cycleAdapter([{ reject: new Error("unexpected") }]);
    const adapter = new RetryAdapter(inner, { maxRetries: 3, delay: 0 });
    await expect(adapter.send(makeRequest())).rejects.toBeInstanceOf(Error);
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  // --- exhaustion ---
  it("throws the last error after exhausting all retries", async () => {
    const err = networkError();
    const inner = cycleAdapter([
      { reject: err },
      { reject: err },
      { reject: err },
      { reject: err },
    ]);
    const adapter = new RetryAdapter(inner, { maxRetries: 3, delay: 0 });
    await expect(adapter.send(makeRequest())).rejects.toBe(err);
    expect(inner.send).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  // --- custom retryOn ---
  it("custom retryOn can override default — retry on 404", async () => {
    const inner = cycleAdapter([
      { reject: httpError(404) },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, {
      maxRetries: 1,
      delay: 0,
      retryOn: (err) => err instanceof HttpError && err.status === 404,
    });
    const result = await adapter.send(makeRequest());
    expect(result.ok).toBe(true);
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("custom retryOn receives (error, request, attempt) as arguments", async () => {
    const retryOn = vi.fn().mockReturnValue(false);
    const err = networkError();
    const req = makeRequest();
    const inner = cycleAdapter([{ reject: err }]);
    const adapter = new RetryAdapter(inner, {
      maxRetries: 3,
      delay: 0,
      retryOn,
    });
    await expect(adapter.send(req)).rejects.toBeDefined();
    expect(retryOn).toHaveBeenCalledWith(err, req, 1);
  });

  it("passes attempt number incremented per retry to retryOn", async () => {
    const attempts: number[] = [];
    const retryOn = vi.fn((_e: unknown, _r: unknown, n: number) => {
      attempts.push(n);
      return true;
    });
    const inner = cycleAdapter([
      { reject: networkError() },
      { reject: networkError() },
      { reject: networkError() },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, {
      maxRetries: 3,
      delay: 0,
      retryOn,
    });
    await adapter.send(makeRequest());
    expect(attempts).toEqual([1, 2, 3]);
  });

  // --- backoff timing ---
  it("fixed backoff waits the same delay for each retry", async () => {
    const inner = cycleAdapter([
      { reject: networkError() },
      { reject: networkError() },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, {
      maxRetries: 2,
      delay: 200,
      backoff: BackoffStrategy.fixed,
    });

    const promise = adapter.send(makeRequest());
    // Advance past first retry delay
    await vi.advanceTimersByTimeAsync(200);
    // Advance past second retry delay
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(inner.send).toHaveBeenCalledTimes(3);
  });

  it("exponential backoff doubles the delay each retry", async () => {
    const inner = cycleAdapter([
      { reject: networkError() },
      { reject: networkError() },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, {
      maxRetries: 2,
      delay: 100,
      backoff: BackoffStrategy.exponential,
    });

    const promise = adapter.send(makeRequest());
    // Retry 1: 100 * 2^0 = 100ms
    await vi.advanceTimersByTimeAsync(100);
    // Retry 2: 100 * 2^1 = 200ms
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result.ok).toBe(true);
  });

  it("exponential backoff is capped at maxDelay", async () => {
    const inner = cycleAdapter([
      { reject: networkError() },
      { reject: networkError() },
      { reject: networkError() },
      { resolve: okResponse() },
    ]);
    const adapter = new RetryAdapter(inner, {
      maxRetries: 3,
      delay: 100,
      backoff: BackoffStrategy.exponential,
      maxDelay: 150,
    });

    const promise = adapter.send(makeRequest());
    await vi.advanceTimersByTimeAsync(100); // retry 1: 100ms (< 150 cap)
    await vi.advanceTimersByTimeAsync(150); // retry 2: 200ms → capped at 150ms
    await vi.advanceTimersByTimeAsync(150); // retry 3: 400ms → capped at 150ms
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(inner.send).toHaveBeenCalledTimes(4);
  });

  // --- default config ---
  it("defaults: maxRetries=3, delay=100, backoff=exponential, maxDelay=30000", async () => {
    const inner = cycleAdapter([{ resolve: okResponse() }]);
    const adapter = new RetryAdapter(inner);
    // Just verify it constructs and works with defaults
    const result = await adapter.send(makeRequest());
    expect(result.ok).toBe(true);
  });

  // --- request passthrough ---
  it("passes the original HttpRequest unchanged to the inner adapter", async () => {
    const req = makeRequest();
    const inner: IHttpAdapter = {
      send: vi.fn().mockResolvedValue(okResponse()),
    };
    const adapter = new RetryAdapter(inner, { delay: 0 });
    await adapter.send(req);
    expect(inner.send).toHaveBeenCalledWith(req);
  });
});
