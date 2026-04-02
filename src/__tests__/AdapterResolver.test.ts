import { describe, it, expect, vi, afterEach } from "vitest";
import { AdapterResolver } from "../adapters/AdapterResolver.ts";
import { BrowserFetchAdapter } from "../adapters/BrowserFetchAdapter.ts";
import { NodeFetchAdapter } from "../adapters/NodeFetchAdapter.ts";

afterEach(() => vi.unstubAllGlobals());

describe("AdapterResolver", () => {
  it("returns NodeFetchAdapter in a Node.js environment (no window)", () => {
    vi.stubGlobal("window", undefined);
    expect(AdapterResolver.resolve()).toBeInstanceOf(NodeFetchAdapter);
  });

  it("returns BrowserFetchAdapter when window.document is present", () => {
    vi.stubGlobal("window", { document: {} });
    expect(AdapterResolver.resolve()).toBeInstanceOf(BrowserFetchAdapter);
  });

  it("returns NodeFetchAdapter when window exists but has no document", () => {
    vi.stubGlobal("window", {});
    expect(AdapterResolver.resolve()).toBeInstanceOf(NodeFetchAdapter);
  });

  it("resolveWith() returns the provided adapter unchanged", () => {
    const adapter = new BrowserFetchAdapter();
    expect(AdapterResolver.resolveWith(adapter)).toBe(adapter);
  });
});
