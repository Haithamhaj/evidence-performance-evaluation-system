import { describe, expect, it } from "vitest";

import { defaultTimeZone, formatDateTime, formatNumber } from "./formatters.js";

describe("locale-aware presentation formatters", () => {
  const instant = new Date("2026-01-15T21:30:00.000Z");

  it("defaults date and time presentation to Asia/Riyadh", () => {
    expect(defaultTimeZone).toBe("Asia/Riyadh");
    expect(formatDateTime(instant, "en")).toContain("00:30");
  });

  it("changes only rendered presentation for an explicit user timezone", () => {
    const originalIso = instant.toISOString();
    const riyadh = formatDateTime(instant, "en");
    const london = formatDateTime(instant, "en", "Europe/London");

    expect(riyadh).not.toBe(london);
    expect(instant.toISOString()).toBe(originalIso);
  });

  it("renders locale-appropriate dates and numbers", () => {
    expect(formatDateTime(instant, "ar")).not.toBe(formatDateTime(instant, "en"));
    expect(formatNumber(12345.67, "ar")).not.toBe(formatNumber(12345.67, "en"));
  });

  it("does not alter a stable criterion identity when locale changes", () => {
    const criterion = { id: "criterion.collaboration", value: instant } as const;

    formatDateTime(criterion.value, "ar");
    formatDateTime(criterion.value, "en");

    expect(criterion.id).toBe("criterion.collaboration");
  });
});
