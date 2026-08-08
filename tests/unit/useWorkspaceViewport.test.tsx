import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceViewport } from "@/hooks/useWorkspaceViewport";

describe("useWorkspaceViewport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("separates tablet shell behavior from mobile navigation behavior", () => {
    const listeners = new Map<string, () => void>();
    const matches = new Map([
      ["(max-width: 1023px)", true],
      ["(max-width: 767px)", false]
    ]);

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: matches.get(query) ?? false,
      media: query,
      onchange: null,
      addEventListener: (_name: string, listener: () => void) => listeners.set(query, listener),
      removeEventListener: () => listeners.delete(query),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    const { result } = renderHook(() => useWorkspaceViewport());
    expect(result.current).toEqual({ isTabletLayout: true, isMobileLayout: false });

    matches.set("(max-width: 767px)", true);
    act(() => listeners.get("(max-width: 767px)")?.());
    expect(result.current).toEqual({ isTabletLayout: true, isMobileLayout: true });
  });
});
