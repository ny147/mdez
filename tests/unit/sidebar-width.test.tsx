import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

describe("sidebar width", () => {
  beforeEach(() => localStorage.clear());

  it("starts at 272px and restores the resized width after remount", () => {
    const first = renderHook(() => useSidebarWidth());
    expect(first.result.current.width).toBe(272);
    act(() => first.result.current.updateWidth(368));
    first.unmount();
    const second = renderHook(() => useSidebarWidth());
    expect(second.result.current.width).toBe(368);
  });

  it.each(["invalid", "null", "[]", "{}", '"400"']) (
    "ignores invalid saved width: %s", (raw) => {
      localStorage.setItem("mdez-sidebar-width", raw);
      expect(renderHook(() => useSidebarWidth()).result.current.width).toBe(272);
    }
  );

  it.each([[100, 240], [900, 480], [318.6, 319]]) (
    "bounds saved width %s to %s", (saved, expected) => {
      localStorage.setItem("mdez-sidebar-width", JSON.stringify(saved));
      expect(renderHook(() => useSidebarWidth()).result.current.width).toBe(expected);
    }
  );

  it("bounds updates and rejects non-finite widths", () => {
    const { result } = renderHook(() => useSidebarWidth());
    act(() => result.current.updateWidth(0));
    expect(result.current.width).toBe(240);
    act(() => result.current.updateWidth(1000));
    expect(result.current.width).toBe(480);
    act(() => result.current.updateWidth(Number.NaN));
    expect(result.current.width).toBe(272);
    act(() => result.current.updateWidth(Infinity));
    expect(result.current.width).toBe(272);
  });

  it("resizes in memory when browser storage is denied", () => {
    const getter = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const setter = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    try {
      const { result } = renderHook(() => useSidebarWidth());
      act(() => result.current.updateWidth(400));
      expect(result.current.width).toBe(400);
    } finally {
      getter.mockRestore();
      setter.mockRestore();
    }
  });
});
