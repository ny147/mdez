import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeTheme, themeScript } from "@/lib/theme";
import { ThemeProvider, useTheme } from "@/components/mdez/ThemeProvider";
import { ThemeControl } from "@/components/mdez/ThemeControl";

let dark = true;
let media: EventTarget;
beforeEach(() => {
  localStorage.clear();
  dark = true;
  media = new EventTarget();
  vi.stubGlobal("matchMedia", () => Object.assign(media, { matches: dark }));
  delete document.documentElement.dataset.theme;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Probe() {
  const { preference, resolvedTheme } = useTheme();
  return <output>{preference}:{resolvedTheme}</output>;
}
function mount() { render(<ThemeProvider><ThemeControl /><Probe /></ThemeProvider>); }

describe("theme initialization", () => {
  it.each([null, "invalid", "system"])("uses the dark device preference for %s", (stored) => {
    if (stored) localStorage.setItem("mdez-theme", stored);
    // Exercise the exact source executed in the document head, without module closures.
    window.eval(themeScript);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("honours a stored light override before hydration", () => {
    localStorage.setItem("mdez-theme", "light");
    window.eval(themeScript);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("falls back to light when the media API is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(initializeTheme().resolvedTheme).toBe("light");
  });
});

describe("theme interaction", () => {
  it("follows device changes until the first click and toggles directly thereafter", () => {
    mount();
    expect(screen.getByText("system:dark")).toBeInTheDocument();
    dark = false;
    act(() => { Object.assign(media, { matches: dark }); media.dispatchEvent(new Event("change")); });
    expect(screen.getByText("system:light")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("mdez-theme")).toBe("dark");
    act(() => media.dispatchEvent(new Event("change")));
    expect(screen.getByText("dark:dark")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(screen.getByText("light:light")).toBeInTheDocument();
    expect(localStorage.getItem("mdez-theme")).toBe("light");
  });
  it("still switches themes when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(screen.getByText("light:light")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("synchronizes another tab's preference and resets to System when cleared", () => {
    mount();
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "mdez-theme", newValue: "light", storageArea: localStorage })));
    expect(screen.getByText("light:light")).toBeInTheDocument();
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: null, storageArea: localStorage })));
    expect(screen.getByText("system:dark")).toBeInTheDocument();
  });
});
