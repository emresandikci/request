import { describe, it, expect, vi, afterEach } from "vitest";
import { AbstractFetchAdapter } from "../adapters/AbstractFetchAdapter.ts";
import { HttpRequest } from "../core/HttpRequest.ts";
import { HttpResponse } from "../core/HttpResponse.ts";
import { NetworkError } from "../errors/NetworkError.ts";
import { TimeoutError } from "../errors/TimeoutError.ts";
import type { RequestConfig, HttpMethod, HttpHeaders } from "../types/index.ts";

const adapter = new AbstractFetchAdapter();

type MakeRequestOptions = Partial<
  Omit<RequestConfig, "method"> & { method: HttpMethod; headers: HttpHeaders }
>;

function makeRequest(overrides: MakeRequestOptions = {}): HttpRequest {
  return new HttpRequest({
    url: overrides.url ?? "https://api.example.com/test",
    method: overrides.method ?? "GET",
    headers: overrides.headers,
    body: overrides.body,
    signal: overrides.signal,
    timeout: overrides.timeout,
    validateStatus: overrides.validateStatus,
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

function stubFetchError(error: unknown): void {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
}

afterEach(() => vi.restoreAllMocks());

describe("AbstractFetchAdapter.send()", () => {
  it("returns an HttpResponse wrapping the native Response", async () => {
    stubFetch(new Response('{"ok":true}', { status: 200 }));
    const res = await adapter.send(makeRequest());
    expect(res).toBeInstanceOf(HttpResponse);
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
  });

  it("passes method and headers to fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await adapter.send(
      makeRequest({
        method: "DELETE",
        headers: { authorization: "Bearer tok" },
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>)["authorization"]).toBe(
      "Bearer tok",
    );
  });

  it("JSON-stringifies an object body and sets content-type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await adapter.send(
      makeRequest({ method: "POST", body: { name: "Alice" } }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"name":"Alice"}');
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );
  });

  it("does not override an existing content-type header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await adapter.send(
      makeRequest({
        method: "POST",
        body: { x: 1 },
        headers: { "content-type": "text/plain" },
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "text/plain",
    );
  });

  it("passes a string body through without JSON-encoding", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await adapter.send(makeRequest({ method: "POST", body: "raw-string" }));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe("raw-string");
  });

  it("passes FormData body through without JSON-encoding", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("key", "value");
    await adapter.send(makeRequest({ method: "POST", body: form }));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("uses a custom validateStatus from config", async () => {
    stubFetch(new Response("{}", { status: 404 }));
    // validateStatus that considers 404 as ok
    const req = makeRequest({ validateStatus: (s: number) => s === 404 });
    const res = await adapter.send(req);
    expect(res.ok).toBe(true);
  });

  it("ok is false when validateStatus returns false", async () => {
    stubFetch(new Response("err", { status: 500 }));
    const res = await adapter.send(makeRequest());
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });

  it("throws NetworkError when fetch rejects with a non-abort error", async () => {
    stubFetchError(new TypeError("failed to fetch"));
    await expect(adapter.send(makeRequest())).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it("throws NetworkError for a user-initiated abort", async () => {
    const ctrl = new AbortController();
    const abortErr = new DOMException("Aborted", "AbortError");
    stubFetchError(abortErr);
    const req = makeRequest({ signal: ctrl.signal });
    await expect(adapter.send(req)).rejects.toBeInstanceOf(NetworkError);
  });

  it("throws TimeoutError when the signal was aborted due to timeout", async () => {
    // Simulate a timed-out AbortSignal: reason is DOMException { name: 'TimeoutError' }
    const timeoutSignal = AbortSignal.timeout(1); // will fire almost immediately
    // Stub fetch to reject with an AbortError
    const abortErr = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr));

    // We need the signal's reason to be a TimeoutError DOMException
    // AbortSignal.timeout sets this natively, but since we mock fetch we must fake the reason
    const fakeSignal = {
      reason: new DOMException("Timeout", "TimeoutError"),
      aborted: true,
    } as unknown as AbortSignal;

    const req = makeRequest({ signal: fakeSignal, timeout: 1 });
    await expect(adapter.send(req)).rejects.toBeInstanceOf(TimeoutError);
    void timeoutSignal; // suppress unused warning
  });
});
