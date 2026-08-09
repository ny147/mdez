import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/relative-time";

const now = Date.parse("2026-08-09T12:00:00.000Z");

describe("formatRelativeTime", () => {
  it("formats minute, hour, and day boundaries", () => {
    expect(formatRelativeTime("2026-08-09T11:59:20.000Z", now)).toBe("1 min ago");
    expect(formatRelativeTime("2026-08-09T11:30:00.000Z", now)).toBe("30 min ago");
    expect(formatRelativeTime("2026-08-09T11:00:01.000Z", now)).toBe("59 min ago");
    expect(formatRelativeTime("2026-08-09T11:00:00.000Z", now)).toBe("1 hr ago");
    expect(formatRelativeTime("2026-08-09T10:00:00.000Z", now)).toBe("2 hr ago");
    expect(formatRelativeTime("2026-08-08T12:00:01.000Z", now)).toBe("23 hr ago");
    expect(formatRelativeTime("2026-08-08T12:00:00.000Z", now)).toBe("1 day ago");
    expect(formatRelativeTime("2026-08-06T12:00:00.000Z", now)).toBe("3 days ago");
  });

  it("uses a neutral label for invalid and future values", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("recently");
    expect(formatRelativeTime("2026-08-10T12:00:00.000Z", now)).toBe("recently");
  });
});
