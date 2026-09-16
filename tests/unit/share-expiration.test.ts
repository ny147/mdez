import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isShareExpired, watchShareExpiration } from "@/lib/share-expiration";

const NOW = "2026-09-15T00:00:00.000Z";

describe("share expiration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats the exact deadline as expired", () => {
    expect(isShareExpired("2026-09-15T00:00:00.001Z", Date.parse(NOW))).toBe(false);
    expect(isShareExpired(NOW, Date.parse(NOW))).toBe(true);
    expect(isShareExpired(null, Date.parse(NOW))).toBe(false);
    expect(isShareExpired("invalid", Date.parse(NOW))).toBe(true);
  });

  it("expires once when the deadline is reached", async () => {
    const onExpire = vi.fn();
    watchShareExpiration("2026-09-15T00:00:01.000Z", onExpire);

    await vi.advanceTimersByTimeAsync(999);
    expect(onExpire).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("does not schedule Never shares and cancels finite shares", async () => {
    const neverExpires = vi.fn();
    const cancelled = vi.fn();
    const stopNever = watchShareExpiration(null, neverExpires);
    const stopFinite = watchShareExpiration("2026-09-15T00:00:01.000Z", cancelled);

    stopNever();
    stopFinite();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(neverExpires).not.toHaveBeenCalled();
    expect(cancelled).not.toHaveBeenCalled();
  });

  it("does not expire a 30-day share at the maximum timeout boundary", async () => {
    const onExpire = vi.fn();
    watchShareExpiration("2026-10-15T00:00:00.000Z", onExpire);

    await vi.advanceTimersByTimeAsync(2_147_483_647);
    expect(onExpire).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(444_516_353);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it.each(["focus", "pageshow"])("rechecks expiration on %s", (eventName) => {
    const onExpire = vi.fn();
    watchShareExpiration("2026-09-15T00:00:01.000Z", onExpire);
    vi.setSystemTime(new Date("2026-09-15T00:00:02.000Z"));

    window.dispatchEvent(new Event(eventName));

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("rechecks expiration when the page becomes visible", () => {
    const onExpire = vi.fn();
    watchShareExpiration("2026-09-15T00:00:01.000Z", onExpire);
    vi.setSystemTime(new Date("2026-09-15T00:00:02.000Z"));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    document.dispatchEvent(new Event("visibilitychange"));

    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
