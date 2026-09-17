import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReaderPreferences } from "@/hooks/useReaderPreferences";

describe("reader preferences", () => {
  beforeEach(() => localStorage.clear());

  it("restores independent settings after remount and resets them", () => {
    const first = renderHook(() => useReaderPreferences());
    act(() => first.result.current.updatePreferences({ fontSize: 24, readWidth: 900, splitPosition: 35 }));
    first.unmount();
    const second = renderHook(() => useReaderPreferences());
    expect(second.result.current.preferences).toEqual({ fontSize: 24, readWidth: 900, splitPosition: 35 });
    act(() => second.result.current.updatePreferences({ fontSize: 18 }));
    expect(second.result.current.preferences.readWidth).toBe(900);
    act(() => second.result.current.resetPreferences());
    expect(second.result.current.preferences).toEqual({ fontSize: 16, readWidth: 720, splitPosition: 50 });
  });

  it.each(["not json", "null", "[]", '{"fontSize":"28","readWidth":null,"splitPosition":{}}']) (
    "ignores invalid saved preferences: %s", (raw) => {
      localStorage.setItem("mdez-reader-preferences", raw);
      const { result } = renderHook(() => useReaderPreferences());
      expect(result.current.preferences).toEqual({ fontSize: 16, readWidth: 720, splitPosition: 50 });
    }
  );

  it("clamps saved values to usable bounds", () => {
    localStorage.setItem("mdez-reader-preferences", '{"fontSize":100,"readWidth":10,"splitPosition":99}');
    const { result } = renderHook(() => useReaderPreferences());
    expect(result.current.preferences).toEqual({ fontSize: 28, readWidth: 320, splitPosition: 70 });
  });

  it("keeps controls usable when browser storage is denied", () => {
    const getter = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const setter = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    try {
      const { result } = renderHook(() => useReaderPreferences());
      act(() => result.current.updatePreferences({ fontSize: 20 }));
      expect(result.current.preferences.fontSize).toBe(20);
    } finally {
      getter.mockRestore();
      setter.mockRestore();
    }
  });
});
