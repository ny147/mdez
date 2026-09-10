import React, { StrictMode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedBrandLogo } from "@/components/mdez/AnimatedBrandLogo";

function motionPreference(reduced: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: reduced }));
}

beforeEach(() => {
  sessionStorage.clear();
  motionPreference(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("brand reveal", () => {
  it("reveals once through StrictMode and stays still after remount", () => {
    const first = render(<StrictMode><AnimatedBrandLogo /></StrictMode>);
    expect(screen.getByRole("img", { name: "Mdez" })).toBeVisible();
    expect(first.container.firstElementChild).toHaveAttribute("data-reveal", "true");
    first.rerender(<StrictMode><AnimatedBrandLogo className="changed" /></StrictMode>);
    expect(first.container.firstElementChild).toHaveAttribute("data-reveal", "true");
    first.unmount();
    const second = render(<AnimatedBrandLogo />);
    expect(second.container.firstElementChild).toHaveAttribute("data-reveal", "false");
  });

  it("uses the settled mark for reduced motion without deferring a reveal", () => {
    motionPreference(true);
    const first = render(<AnimatedBrandLogo />);
    expect(first.container.firstElementChild).toHaveAttribute("data-reveal", "false");
    first.unmount();
    motionPreference(false);
    const second = render(<AnimatedBrandLogo />);
    expect(second.container.firstElementChild).toHaveAttribute("data-reveal", "false");
  });

  it("keeps branding visible and still when browser storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    const result = render(<AnimatedBrandLogo />);
    expect(result.container.firstElementChild).toHaveAttribute("data-reveal", "false");
    expect(screen.getByRole("img", { name: "Mdez" })).toBeVisible();
  });

  it("keeps the settled mark when the session flag cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const result = render(<AnimatedBrandLogo />);
    expect(result.container.firstElementChild).toHaveAttribute("data-reveal", "false");
  });
});
