import { describe, it, expect } from "vitest";
import { HttpError } from "../errors/HttpError.ts";
import { NetworkError } from "../errors/NetworkError.ts";
import { TimeoutError } from "../errors/TimeoutError.ts";
import { HttpResponse } from "../core/HttpResponse.ts";

function makeResponse(status: number): HttpResponse {
  return new HttpResponse(new Response("{}", { status }), false);
}

describe("HttpError", () => {
  it("extends Error", () => {
    const err = new HttpError("bad", makeResponse(404), {});
    expect(err).toBeInstanceOf(Error);
  });

  it("name is HttpError", () => {
    expect(new HttpError("x", makeResponse(500), {}).name).toBe("HttpError");
  });

  it("exposes status shortcut", () => {
    const err = new HttpError("msg", makeResponse(422), {});
    expect(err.status).toBe(422);
    expect(err.response.status).toBe(422);
  });

  it("sanitizes sensitive headers in config", () => {
    const config = {
      url: "/test",
      timeout: 5000,
      headers: {
        Authorization: "Bearer secret-token",
        "x-api-key": "apikey-value",
        "x-request-id": "req-123",
      },
    };
    const err = new HttpError("msg", makeResponse(500), config);
    expect(err.config).not.toBe(config);
    expect(err.config.headers?.Authorization).toBe("[REDACTED]");
    expect(err.config.headers?.["x-api-key"]).toBe("[REDACTED]");
    expect(err.config.headers?.["x-request-id"]).toBe("req-123");
  });
});

describe("NetworkError", () => {
  it("extends Error", () => {
    expect(new NetworkError("fail", {})).toBeInstanceOf(Error);
  });

  it("name is NetworkError", () => {
    expect(new NetworkError("fail", {}).name).toBe("NetworkError");
  });

  it("wraps the cause", () => {
    const cause = new TypeError("fetch failed");
    const err = new NetworkError("fail", {}, cause);
    expect(err.cause).toBe(cause);
  });

  it("redacts sensitive headers in config", () => {
    const err = new NetworkError("fail", {
      headers: {
        cookie: "session=abc",
        "x-auth-token": "xyz",
        "x-trace-id": "trace",
      },
    });
    expect(err.config.headers?.cookie).toBe("[REDACTED]");
    expect(err.config.headers?.["x-auth-token"]).toBe("[REDACTED]");
    expect(err.config.headers?.["x-trace-id"]).toBe("trace");
  });
});

describe("TimeoutError", () => {
  it("extends Error", () => {
    expect(new TimeoutError({ timeout: 3000 })).toBeInstanceOf(Error);
  });

  it("name is TimeoutError", () => {
    expect(new TimeoutError({ timeout: 1000 }).name).toBe("TimeoutError");
  });

  it("message includes the timeout value", () => {
    const err = new TimeoutError({ timeout: 5000 });
    expect(err.message).toContain("5000");
    expect(err.timeout).toBe(5000);
  });

  it("timeout defaults to 0 when config.timeout is undefined", () => {
    const err = new TimeoutError({});
    expect(err.timeout).toBe(0);
  });

  it("redacts sensitive headers in config", () => {
    const err = new TimeoutError({
      timeout: 100,
      headers: {
        "Proxy-Authorization": "Basic abc",
        "x-safe": "ok",
      },
    });
    expect(err.config.headers?.["Proxy-Authorization"]).toBe("[REDACTED]");
    expect(err.config.headers?.["x-safe"]).toBe("ok");
  });
});
