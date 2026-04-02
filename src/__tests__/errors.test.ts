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

  it("carries the original config", () => {
    const config = { url: "/test", timeout: 5000 };
    const err = new HttpError("msg", makeResponse(500), config);
    expect(err.config).toBe(config);
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
});
