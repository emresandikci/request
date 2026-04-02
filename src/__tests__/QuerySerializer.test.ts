import { describe, it, expect } from "vitest";
import { QuerySerializer } from "../utils/QuerySerializer.ts";

describe("QuerySerializer", () => {
  describe("basic key-value pairs", () => {
    it("serializes a single string value", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ q: "hello" })).toBe("q=hello");
    });

    it("serializes multiple entries", () => {
      const s = new QuerySerializer();
      const result = s.serialize({ page: 1, limit: 10 });
      expect(result).toBe("page=1&limit=10");
    });

    it("serializes boolean values", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ active: true, deleted: false })).toBe(
        "active=true&deleted=false",
      );
    });

    it("percent-encodes special characters in keys and values", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ "my key": "a&b=c" })).toBe("my%20key=a%26b%3Dc");
    });
  });

  describe("null / undefined handling", () => {
    it("skips null values", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ a: null, b: "ok" })).toBe("b=ok");
    });

    it("skips undefined values", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ a: undefined, b: "ok" })).toBe("b=ok");
    });

    it("returns empty string when all values are null/undefined", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ a: null, b: undefined })).toBe("");
    });
  });

  describe("arrayFormat: 'repeat' (default)", () => {
    it("repeats the key for each value", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ ids: [1, 2, 3] })).toBe("ids=1&ids=2&ids=3");
    });

    it("skips null/undefined entries inside arrays", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ ids: [1, null, 3, undefined] })).toBe("ids=1&ids=3");
    });

    it("skips the key entirely when all array items are null/undefined", () => {
      const s = new QuerySerializer();
      expect(s.serialize({ ids: [null, undefined] })).toBe("");
    });
  });

  describe("arrayFormat: 'comma'", () => {
    it("joins values with an unencoded comma separator", () => {
      const s = new QuerySerializer({ arrayFormat: "comma" });
      // Commas in the value position are not double-encoded — standard practice.
      expect(s.serialize({ ids: [1, 2, 3] })).toBe("ids=1,2,3");
    });
  });

  describe("arrayFormat: 'bracket'", () => {
    it("appends [] to the key for each value", () => {
      const s = new QuerySerializer({ arrayFormat: "bracket" });
      // [] are appended after the already-encoded key; servers expect literal brackets.
      expect(s.serialize({ ids: [1, 2] })).toBe("ids[]=1&ids[]=2");
    });
  });

  it("returns an empty string for an empty params object", () => {
    expect(new QuerySerializer().serialize({})).toBe("");
  });
});
