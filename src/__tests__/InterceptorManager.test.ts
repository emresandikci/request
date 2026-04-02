import { describe, it, expect, vi } from "vitest";
import { InterceptorManager } from "../interceptors/InterceptorManager.ts";

describe("InterceptorManager", () => {
  it("use() returns incrementing numeric IDs", () => {
    const mgr = new InterceptorManager<string>();
    expect(mgr.use(() => "a")).toBe(0);
    expect(mgr.use(() => "b")).toBe(1);
    expect(mgr.use(() => "c")).toBe(2);
  });

  it("forEach() iterates handlers in insertion order", () => {
    const mgr = new InterceptorManager<number>();
    const calls: number[] = [];
    mgr.use((v) => {
      calls.push(1);
      return v;
    });
    mgr.use((v) => {
      calls.push(2);
      return v;
    });
    mgr.use((v) => {
      calls.push(3);
      return v;
    });
    mgr.forEach((h) => h.onFulfilled?.(0));
    expect(calls).toEqual([1, 2, 3]);
  });

  it("eject() removes a handler so forEach skips it", () => {
    const mgr = new InterceptorManager<string>();
    const fn = vi.fn((v: string) => v);
    const id = mgr.use(fn);
    mgr.eject(id);
    mgr.forEach((h) => h.onFulfilled?.("x"));
    expect(fn).not.toHaveBeenCalled();
  });

  it("eject() is a no-op for unknown IDs", () => {
    const mgr = new InterceptorManager<string>();
    expect(() => mgr.eject(999)).not.toThrow();
  });

  it("clear() removes all handlers", () => {
    const mgr = new InterceptorManager<string>();
    const fn = vi.fn((v: string) => v);
    mgr.use(fn);
    mgr.use(fn);
    mgr.clear();
    mgr.forEach((h) => h.onFulfilled?.("x"));
    expect(fn).not.toHaveBeenCalled();
  });

  it("use() accepts only onFulfilled", () => {
    const mgr = new InterceptorManager<number>();
    const fn = vi.fn((v: number) => v * 2);
    mgr.use(fn);
    mgr.forEach((h) => h.onFulfilled?.(5));
    expect(fn).toHaveBeenCalledWith(5);
  });

  it("use() accepts only onRejected", () => {
    const mgr = new InterceptorManager<number>();
    const onRejected = vi.fn();
    mgr.use(undefined, onRejected);
    mgr.forEach((h) => h.onRejected?.("err"));
    expect(onRejected).toHaveBeenCalledWith("err");
  });

  it("remaining handlers still iterate after an eject", () => {
    const mgr = new InterceptorManager<string>();
    const calls: string[] = [];
    const id = mgr.use((v) => {
      calls.push("A");
      return v;
    });
    mgr.use((v) => {
      calls.push("B");
      return v;
    });
    mgr.eject(id);
    mgr.forEach((h) => h.onFulfilled?.("x"));
    expect(calls).toEqual(["B"]);
  });
});
