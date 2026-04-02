import { describe, it, expect } from "vitest";
import { HttpResponse } from "../core/HttpResponse.ts";

function makeRaw(
  body: string,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("HttpResponse", () => {
  it("exposes status from the native Response", () => {
    const raw = makeRaw("{}", 200);
    const res = new HttpResponse(raw, true);
    expect(res.status).toBe(200);
    // statusText may be '' in environments that comply with the Fetch spec strictly
    expect(typeof res.statusText).toBe("string");
  });

  it("ok reflects the passed boolean, not the native response ok", () => {
    const raw = makeRaw("{}", 200);
    // validateStatus could say false even for a 200
    const res = new HttpResponse(raw, false);
    expect(res.ok).toBe(false);
  });

  it("parses headers into a frozen plain record", () => {
    const raw = makeRaw("{}", 200, { "x-request-id": "abc123" });
    const res = new HttpResponse(raw, true);
    expect(res.headers["x-request-id"]).toBe("abc123");
    expect(Object.isFrozen(res.headers)).toBe(true);
  });

  it("exposes the raw native Response", () => {
    const raw = makeRaw("{}");
    const res = new HttpResponse(raw, true);
    expect(res.raw).toBe(raw);
  });

  describe("body helpers", () => {
    it("json() returns parsed data typed as TData", async () => {
      const raw = makeRaw('{"id":1,"name":"Alice"}');
      const res = new HttpResponse<{ id: number; name: string }>(raw, true);
      const data = await res.json();
      expect(data).toEqual({ id: 1, name: "Alice" });
    });

    it("text() returns the body as a string", async () => {
      const raw = new Response("hello world", { status: 200 });
      const res = new HttpResponse(raw, true);
      expect(await res.text()).toBe("hello world");
    });

    it("blob() returns a Blob", async () => {
      const raw = new Response("binary", { status: 200 });
      const res = new HttpResponse(raw, true);
      const blob = await res.blob();
      expect(blob).toBeInstanceOf(Blob);
    });

    it("arrayBuffer() returns an ArrayBuffer", async () => {
      const raw = new Response("data", { status: 200 });
      const res = new HttpResponse(raw, true);
      const buf = await res.arrayBuffer();
      expect(buf).toBeInstanceOf(ArrayBuffer);
    });
  });
});
