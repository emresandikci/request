import { describe, it, expect } from "vitest";
import { HttpRequest } from "../core/HttpRequest.ts";

const base = { url: "https://api.example.com/users", method: "GET" as const };

describe("HttpRequest", () => {
  it("stores method, url, and headers from config", () => {
    const req = new HttpRequest({
      ...base,
      headers: { authorization: "Bearer tok" },
    });
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://api.example.com/users");
    expect(req.headers["authorization"]).toBe("Bearer tok");
  });

  it("stores body and signal", () => {
    const ctrl = new AbortController();
    const req = new HttpRequest({
      ...base,
      method: "POST",
      body: { name: "Alice" },
      signal: ctrl.signal,
    });
    expect(req.body).toEqual({ name: "Alice" });
    expect(req.signal).toBe(ctrl.signal);
  });

  it("body is undefined when not provided", () => {
    const req = new HttpRequest(base);
    expect(req.body).toBeUndefined();
  });

  it("headers object is frozen", () => {
    const req = new HttpRequest({ ...base, headers: { "x-foo": "bar" } });
    expect(Object.isFrozen(req.headers)).toBe(true);
  });

  it("config back-reference is frozen", () => {
    const req = new HttpRequest(base);
    expect(Object.isFrozen(req.config)).toBe(true);
  });

  describe("withHeaders()", () => {
    it("returns a new HttpRequest instance", () => {
      const req = new HttpRequest(base);
      const next = req.withHeaders({ "x-request-id": "123" });
      expect(next).not.toBe(req);
    });

    it("merges new headers with existing ones", () => {
      const req = new HttpRequest({
        ...base,
        headers: { authorization: "Bearer tok" },
      });
      const next = req.withHeaders({ "x-request-id": "123" });
      expect(next.headers["authorization"]).toBe("Bearer tok");
      expect(next.headers["x-request-id"]).toBe("123");
    });

    it("overrides an existing header", () => {
      const req = new HttpRequest({ ...base, headers: { "x-foo": "old" } });
      const next = req.withHeaders({ "x-foo": "new" });
      expect(next.headers["x-foo"]).toBe("new");
    });

    it("original request is not mutated", () => {
      const req = new HttpRequest({
        ...base,
        headers: { "x-foo": "original" },
      });
      req.withHeaders({ "x-foo": "changed" });
      expect(req.headers["x-foo"]).toBe("original");
    });

    it("preserves the same url and method", () => {
      const req = new HttpRequest(base);
      const next = req.withHeaders({ "x-a": "1" });
      expect(next.url).toBe(req.url);
      expect(next.method).toBe(req.method);
    });
  });
});
