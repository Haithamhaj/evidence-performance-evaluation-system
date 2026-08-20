import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadShellContext: vi.fn().mockResolvedValue({
    principal: { active: true, roles: ["employee"] },
  }),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("../../server/shell/load-shell-context", () => ({
  loadShellContext: mocks.loadShellContext,
}));

import HomePage from "./page.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("localized home route", () => {
  it.each(["ar", "en"] as const)(
    "opens My Work as the default employee home for %s",
    async (locale) => {
      await HomePage({ params: Promise.resolve({ locale }) });

      expect(mocks.redirect).toHaveBeenCalledWith(`/${locale}/my-work`);
    },
  );
});
