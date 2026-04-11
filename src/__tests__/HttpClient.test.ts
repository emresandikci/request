import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { HttpClient } from "../core/HttpClient.ts";
import { HttpResponse } from "../core/HttpResponse.ts";
import { HttpError } from "../errors/HttpError.ts";
import { NetworkError } from "../errors/NetworkError.ts";
import { TimeoutError } from "../errors/TimeoutError.ts";
import type { IHttpAdapter } from "../adapters/IHttpAdapter.ts";
import type { HttpRequest } from "../core/HttpRequest.ts";

// ---------- helpers ----------

function mockAdapter(status = 200, body = "{}"): IHttpAdapter {
  return {
    send: vi
      .fn()
      .mockResolvedValue(
        new HttpResponse(
          new Response(body, { status }),
          status >= 200 && status < 300,
        ),
      ),
  };
}

function mockAdapterWithError(error: unknown): IHttpAdapter {
  return { send: vi.fn().mockRejectedValue(error) };
}

afterEach(() => vi.restoreAllMocks());

// ---------- HTTP verbs ----------

describe("HTTP verb methods", () => {
  it("get() dispatches a GET request", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient({}, adapter);
    await client.get("/users");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.method).toBe("GET");
  });

  it("post() dispatches a POST request with body", async () => {
    const adapter = mockAdapter(201, '{"id":1}');
    const client = new HttpClient({}, adapter);
    await client.post("/users", { name: "Alice" });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.method).toBe("POST");
    expect(req.body).toEqual({ name: "Alice" });
  });

  it("put() dispatches a PUT request", async () => {
    const adapter = mockAdapter();
    await new HttpClient({}, adapter).put("/users/1", { name: "Bob" });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.method).toBe("PUT");
  });

  it("patch() dispatches a PATCH request", async () => {
    const adapter = mockAdapter();
    await new HttpClient({}, adapter).patch("/users/1", { name: "Bob" });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.method).toBe("PATCH");
  });

  it("delete() dispatches a DELETE request", async () => {
    const adapter = mockAdapter(200, "{}");
    await new HttpClient({}, adapter).delete("/users/1");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.method).toBe("DELETE");
  });

  it("head() dispatches a HEAD request", async () => {
    const adapter = mockAdapter(200, "{}");
    await new HttpClient({}, adapter).head("/");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.method).toBe("HEAD");
  });

  it("options() dispatches an OPTIONS request", async () => {
    const adapter = mockAdapter();
    await new HttpClient({}, adapter).options("/");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.method).toBe("OPTIONS");
  });
});

// ---------- URL resolution ----------

describe("URL resolution", () => {
  it("prepends baseURL to relative paths", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );
    await client.get("/users");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toBe("https://api.example.com/users");
  });

  it("strips a trailing slash from baseURL", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { baseURL: "https://api.example.com/" },
      adapter,
    );
    await client.get("/users");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toBe("https://api.example.com/users");
  });

  it("uses an absolute URL as-is even when baseURL is set", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );
    await client.get("https://other.example.com/data");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toBe("https://other.example.com/data");
  });

  it("rejects forbidden schemes even when baseURL is set", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );

    await expect(client.get("javascript:alert(1)")).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it("rejects unsupported absolute schemes", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient({}, adapter);

    await expect(client.get("ftp://example.com/file")).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(adapter.send).not.toHaveBeenCalled();
  });
});

// ---------- Headers ----------

describe("header merging", () => {
  it("deep-merges instance headers with request headers", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { headers: { authorization: "Bearer tok", "x-app": "v1" } },
      adapter,
    );
    await client.get("/me", { headers: { "x-request-id": "123" } });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.headers["authorization"]).toBe("Bearer tok");
    expect(req.headers["x-app"]).toBe("v1");
    expect(req.headers["x-request-id"]).toBe("123");
  });

  it("request-level headers override instance headers", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { headers: { authorization: "Bearer old" } },
      adapter,
    );
    await client.get("/me", { headers: { authorization: "Bearer new" } });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.headers["authorization"]).toBe("Bearer new");
  });
});

// ---------- Query params ----------

describe("query params", () => {
  it("appends serialized params to the URL", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );
    await client.get("/search", { params: { q: "hello", page: 2 } });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toContain("q=hello");
    expect(req.url).toContain("page=2");
  });

  it("uses a custom querySerializer when provided", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );
    const customSerializer = { serialize: vi.fn(() => "custom=1") };
    await client.get("/items", {
      params: { ids: [1, 2] },
      querySerializer: customSerializer,
    });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(customSerializer.serialize).toHaveBeenCalled();
    expect(req.url).toContain("custom=1");
  });
});

// ---------- TypeScript generics ----------

describe("TypeScript generic type flow", () => {
  it("get<T>() returns HttpResponse<T>", async () => {
    interface User {
      id: number;
      name: string;
    }
    const adapter = mockAdapter(200, '{"id":1,"name":"Alice"}');
    const client = new HttpClient({}, adapter);
    const res = await client.get<User>("/users/1");
    expect(res).toBeInstanceOf(HttpResponse);
    const user = await res.json();
    expect(user.id).toBe(1);
    expect(user.name).toBe("Alice");
  });

  it("post<Res, Req>() sends the body and returns typed response", async () => {
    interface CreateUserReq {
      name: string;
    }
    interface CreateUserRes {
      id: number;
      name: string;
    }
    const adapter: IHttpAdapter = {
      send: vi.fn().mockImplementation(async (req: HttpRequest) => {
        const raw = new Response(
          JSON.stringify({ id: 99, name: (req.body as CreateUserReq).name }),
          { status: 201 },
        );
        return new HttpResponse<CreateUserRes>(raw, true);
      }),
    };
    const client = new HttpClient({}, adapter);
    const res = await client.post<CreateUserRes, CreateUserReq>("/users", {
      name: "Bob",
    });
    const data = await res.json();
    expect(data.id).toBe(99);
    expect(data.name).toBe("Bob");
  });
});

// ---------- Error handling ----------

describe("error handling", () => {
  it("throws HttpError for 4xx responses", async () => {
    const adapter = mockAdapter(404);
    const client = new HttpClient({}, adapter);
    await expect(client.get("/missing")).rejects.toBeInstanceOf(HttpError);
  });

  it("HttpError carries status and config", async () => {
    const adapter = mockAdapter(422);
    const client = new HttpClient({}, adapter);
    try {
      await client.get("/bad");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(422);
    }
  });

  it("throws HttpError for 5xx responses", async () => {
    const adapter = mockAdapter(500);
    await expect(
      new HttpClient({}, adapter).get("/fail"),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("propagates NetworkError from the adapter", async () => {
    const err = new NetworkError("DNS fail", {});
    const adapter = mockAdapterWithError(err);
    await expect(new HttpClient({}, adapter).get("/x")).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it("propagates TimeoutError from the adapter", async () => {
    const err = new TimeoutError({ timeout: 1000 });
    const adapter = mockAdapterWithError(err);
    await expect(new HttpClient({}, adapter).get("/x")).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it("respects a custom validateStatus predicate", async () => {
    // 404 should be treated as ok
    const adapter: IHttpAdapter = {
      send: vi
        .fn()
        .mockResolvedValue(
          new HttpResponse(new Response("not found", { status: 404 }), true),
        ),
    };
    const client = new HttpClient({ validateStatus: (s) => s < 500 }, adapter);
    const res = await client.get("/maybe");
    expect(res.status).toBe(404);
  });
});

// ---------- Request interceptors ----------

describe("request interceptors", () => {
  it("runs request interceptors and can modify the config", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient({}, adapter);
    client.interceptors.request.use((config) => ({
      ...config,
      headers: { ...config.headers, "x-injected": "yes" },
    }));
    await client.get("/me");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.headers["x-injected"]).toBe("yes");
  });

  it("runs multiple request interceptors in LIFO order", async () => {
    const order: number[] = [];
    const adapter = mockAdapter();
    const client = new HttpClient({}, adapter);
    client.interceptors.request.use((c) => {
      order.push(1);
      return c;
    });
    client.interceptors.request.use((c) => {
      order.push(2);
      return c;
    });
    client.interceptors.request.use((c) => {
      order.push(3);
      return c;
    });
    await client.get("/x");
    expect(order).toEqual([3, 2, 1]);
  });

  it("ejected interceptors are not called", async () => {
    const fn = vi.fn((c: unknown) => c);
    const adapter = mockAdapter();
    const client = new HttpClient({}, adapter);
    const id = client.interceptors.request.use(fn as never);
    client.interceptors.request.eject(id);
    await client.get("/x");
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------- Response interceptors ----------

describe("response interceptors", () => {
  it("runs response interceptors in FIFO order", async () => {
    const order: number[] = [];
    const adapter = mockAdapter();
    const client = new HttpClient({}, adapter);
    client.interceptors.response.use((r) => {
      order.push(1);
      return r;
    });
    client.interceptors.response.use((r) => {
      order.push(2);
      return r;
    });
    await client.get("/x");
    expect(order).toEqual([1, 2]);
  });

  it("a response interceptor onRejected can catch HttpError (e.g. 401 refresh pattern)", async () => {
    const adapter = mockAdapter(401);
    const client = new HttpClient({}, adapter);
    const recovered = new HttpResponse(
      new Response("{}", { status: 200 }),
      true,
    );
    client.interceptors.response.use(undefined, () => recovered);
    const res = (await client.get("/secure")) as HttpResponse;
    expect(res.status).toBe(200);
  });
});

// ---------- Hooks ----------

describe("hooks.beforeRequest", () => {
  it("is called before the request is dispatched", async () => {
    const hook = vi.fn((c: unknown) => c);
    const adapter = mockAdapter();
    const client = new HttpClient(
      { hooks: { beforeRequest: [hook as never] } },
      adapter,
    );
    await client.get("/x");
    expect(hook).toHaveBeenCalled();
  });

  it("can modify the request config (e.g. inject a header)", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      {
        hooks: {
          beforeRequest: [
            (config) => ({
              ...config,
              headers: { ...config.headers, "x-hook": "added" },
            }),
          ],
        },
      },
      adapter,
    );
    await client.get("/x");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.headers["x-hook"]).toBe("added");
  });

  it("a void return leaves the config unchanged", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      {
        baseURL: "https://api.example.com",
        hooks: { beforeRequest: [() => undefined] },
      },
      adapter,
    );
    await client.get("/users");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toBe("https://api.example.com/users");
  });

  it("multiple beforeRequest hooks run in order", async () => {
    const order: number[] = [];
    const adapter = mockAdapter();
    const client = new HttpClient(
      {
        hooks: {
          beforeRequest: [
            (c) => {
              order.push(1);
              return c;
            },
            (c) => {
              order.push(2);
              return c;
            },
          ],
        },
      },
      adapter,
    );
    await client.get("/x");
    expect(order).toEqual([1, 2]);
  });
});

describe("hooks.afterResponse", () => {
  it("is called after a successful response", async () => {
    const hook = vi.fn((r: HttpResponse) => r);
    const adapter = mockAdapter();
    const client = new HttpClient(
      { hooks: { afterResponse: [hook as never] } },
      adapter,
    );
    await client.get("/x");
    expect(hook).toHaveBeenCalled();
  });

  it("can replace the response", async () => {
    const replacement = new HttpResponse(
      new Response('{"replaced":true}', { status: 200 }),
      true,
    );
    const adapter = mockAdapter();
    const client = new HttpClient(
      {
        hooks: { afterResponse: [() => replacement] },
      },
      adapter,
    );
    const res = await client.get("/x");
    expect(res).toBe(replacement);
  });

  it("is NOT called when the response is an error (non-2xx)", async () => {
    const hook = vi.fn();
    const adapter = mockAdapter(500);
    const client = new HttpClient(
      { hooks: { afterResponse: [hook] } },
      adapter,
    );
    await expect(client.get("/fail")).rejects.toBeInstanceOf(HttpError);
    expect(hook).not.toHaveBeenCalled();
  });
});

describe("hooks.beforeError", () => {
  it("is called when an HttpError is thrown", async () => {
    const hook = vi.fn((e: Error) => e);
    const adapter = mockAdapter(404);
    const client = new HttpClient({ hooks: { beforeError: [hook] } }, adapter);
    await expect(client.get("/missing")).rejects.toBeInstanceOf(HttpError);
    expect(hook).toHaveBeenCalled();
  });

  it("can replace the thrown error", async () => {
    class CustomError extends Error {
      name = "CustomError";
    }
    const adapter = mockAdapter(500);
    const client = new HttpClient(
      {
        hooks: { beforeError: [() => new CustomError("wrapped")] },
      },
      adapter,
    );
    await expect(client.get("/fail")).rejects.toBeInstanceOf(CustomError);
  });

  it("a void return re-throws the original error", async () => {
    const adapter = mockAdapter(503);
    const client = new HttpClient(
      { hooks: { beforeError: [() => undefined] } },
      adapter,
    );
    await expect(client.get("/fail")).rejects.toBeInstanceOf(HttpError);
  });

  it("is called for NetworkError too", async () => {
    const hook = vi.fn((e: Error) => e);
    const err = new NetworkError("DNS fail", {});
    const adapter = mockAdapterWithError(err);
    const client = new HttpClient({ hooks: { beforeError: [hook] } }, adapter);
    await expect(client.get("/x")).rejects.toBeDefined();
    expect(hook).toHaveBeenCalled();
  });
});

// ---------- create() ----------

describe("create()", () => {
  it("inherits baseURL from parent", async () => {
    const adapter = mockAdapter();
    const parent = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );
    const child = parent.create();
    await child.get("/items");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toBe("https://api.example.com/items");
  });

  it("child config overrides parent config", async () => {
    const adapter = mockAdapter();
    const parent = new HttpClient(
      { baseURL: "https://a.example.com" },
      adapter,
    );
    const child = parent.create({ baseURL: "https://b.example.com" });
    await child.get("/x");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toBe("https://b.example.com/x");
  });

  it("child inherits merged headers from parent", async () => {
    const adapter = mockAdapter();
    const parent = new HttpClient(
      { headers: { authorization: "Bearer tok" } },
      adapter,
    );
    const child = parent.create({ headers: { "x-tenant": "acme" } });
    await child.get("/x");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.headers["authorization"]).toBe("Bearer tok");
    expect(req.headers["x-tenant"]).toBe("acme");
  });

  it("child starts with empty interceptors (not inherited)", async () => {
    const fn = vi.fn((c: unknown) => c);
    const adapter = mockAdapter();
    const parent = new HttpClient({}, adapter);
    parent.interceptors.request.use(fn as never);
    const child = parent.create();
    await child.get("/x");
    expect(fn).not.toHaveBeenCalled();
  });

  it("child inherits hooks from parent (merged)", async () => {
    const parentHook = vi.fn((c: unknown) => c);
    const childHook = vi.fn((c: unknown) => c);
    const adapter = mockAdapter();
    const parent = new HttpClient(
      { hooks: { beforeRequest: [parentHook as never] } },
      adapter,
    );
    const child = parent.create({
      hooks: { beforeRequest: [childHook as never] },
    });
    await child.get("/x");
    expect(parentHook).toHaveBeenCalled();
    expect(childHook).toHaveBeenCalled();
  });
});

// ---------- Custom adapter injection ----------

describe("custom adapter", () => {
  it("uses the provided adapter instead of auto-resolved one", async () => {
    const customAdapter: IHttpAdapter = {
      send: vi
        .fn()
        .mockResolvedValue(
          new HttpResponse(
            new Response('{"custom":true}', { status: 200 }),
            true,
          ),
        ),
    };
    const client = new HttpClient({}, customAdapter);
    const res = await client.get("/x");
    expect(customAdapter.send).toHaveBeenCalled();
    const data = (await res.json()) as { custom: boolean };
    expect(data.custom).toBe(true);
  });
});

// ---------- Abort / timeout ----------

describe("abort and timeout", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("passes the user signal to the adapter", async () => {
    const ctrl = new AbortController();
    const adapter: IHttpAdapter = {
      send: vi.fn().mockImplementation(async (req: HttpRequest) => {
        expect(req.signal).toBeDefined();
        return new HttpResponse(new Response("{}", { status: 200 }), true);
      }),
    };
    const client = new HttpClient({}, adapter);
    await client.get("/x", { signal: ctrl.signal });
    expect(adapter.send).toHaveBeenCalled();
  });

  it("sends no signal when there is no timeout and no user signal", async () => {
    const adapter: IHttpAdapter = {
      send: vi.fn().mockImplementation(async (req: HttpRequest) => {
        expect(req.signal).toBeUndefined();
        return new HttpResponse(new Response("{}", { status: 200 }), true);
      }),
    };
    await new HttpClient({}, adapter).get("/x");
    expect(adapter.send).toHaveBeenCalled();
  });

  it("merges timeout signal and user signal when both are provided", async () => {
    const ctrl = new AbortController();
    const adapter: IHttpAdapter = {
      send: vi.fn().mockImplementation(async (req: HttpRequest) => {
        // AbortSignal.any() merges multiple signals — signal must be defined
        expect(req.signal).toBeDefined();
        return new HttpResponse(new Response("{}", { status: 200 }), true);
      }),
    };
    await new HttpClient({ timeout: 5000 }, adapter).get("/x", {
      signal: ctrl.signal,
    });
  });
});

// ---------- Edge cases ----------

describe("edge cases", () => {
  it("appends params with & when URL already contains ?", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );
    await client.get("/search?existing=1", { params: { q: "hello" } });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toContain("existing=1");
    expect(req.url).toContain("q=hello");
    expect(req.url).not.toContain("??");
  });

  it("does not append ? when params serializes to an empty string", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );
    // All values null → serializer returns ''
    await client.get("/items", { params: { x: null } });
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).not.toContain("?");
  });

  it("create() with no arguments inherits everything and starts with empty hooks when parent has none", async () => {
    const adapter = mockAdapter();
    const parent = new HttpClient(
      { baseURL: "https://api.example.com" },
      adapter,
    );
    const child = parent.create();
    await child.get("/ping");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toBe("https://api.example.com/ping");
  });

  it("request() with no instance config uses the request url as-is", async () => {
    const adapter = mockAdapter();
    const client = new HttpClient({}, adapter);
    await client.get("https://direct.example.com/data");
    const req = (adapter.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HttpRequest;
    expect(req.url).toBe("https://direct.example.com/data");
  });

  it("create() with hooks on child but no hooks on parent", async () => {
    const childHook = vi.fn((c: unknown) => c);
    const adapter = mockAdapter();
    const parent = new HttpClient({}, adapter); // no hooks
    const child = parent.create({
      hooks: { beforeRequest: [childHook as never] },
    });
    await child.get("/x");
    expect(childHook).toHaveBeenCalled();
  });

  it("create() with hooks on parent but no hooks on child", async () => {
    const parentHook = vi.fn((c: unknown) => c);
    const adapter = mockAdapter();
    const parent = new HttpClient(
      { hooks: { beforeRequest: [parentHook as never] } },
      adapter,
    );
    const child = parent.create(); // no hooks override
    await child.get("/x");
    expect(parentHook).toHaveBeenCalled();
  });

  it("beforeError hook with empty array does not suppress original error", async () => {
    const adapter = mockAdapter(500);
    const client = new HttpClient({ hooks: { beforeError: [] } }, adapter);
    await expect(client.get("/fail")).rejects.toBeInstanceOf(HttpError);
  });

  it("default validateStatus treats 3xx as an error (exercises DEFAULT_VALIDATE_STATUS via real adapter)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Moved", { status: 301 })),
    );
    // No custom adapter → AdapterResolver picks NodeFetchAdapter which calls globalThis.fetch
    // DEFAULT_VALIDATE_STATUS(301) → 301 >= 200 true && 301 < 300 false → false
    const client = new HttpClient({ baseURL: "https://api.example.com" });
    await expect(client.get("/redirect")).rejects.toBeInstanceOf(HttpError);
    vi.restoreAllMocks();
  });
});
