import { describe, expect, it } from "vitest";

import { buildShellModel, homeHrefForPrincipal, localeSwitchHref } from "./shell-model.js";

const employee = { active: true, roles: [] as string[] };

describe("stable shell model", () => {
  it("shows the employee's stable daily destinations and capture entry", () => {
    const model = buildShellModel({ locale: "en", principal: employee });

    expect(model.navigation.map(({ id }) => id)).toEqual([
      "today",
      "work",
      "projects",
      "insights",
      "research",
      "evaluation",
      "settings",
      "help",
    ]);
    expect(model.globalEntries.find(({ id }) => id === "capture")?.visible).toBe(true);
  });

  it("can move Work to the parity workspace while retaining the legacy default", () => {
    expect(
      buildShellModel({ locale: "en", principal: employee }).navigation.find(
        ({ id }) => id === "work",
      )?.href,
    ).toBe("/en/my-work");
    expect(
      buildShellModel({
        locale: "en",
        principal: employee,
        workHref: "/en/tasks",
      }).navigation.find(({ id }) => id === "work")?.href,
    ).toBe("/en/tasks");
  });

  it("adds manager operations without granting employee capture by role alone", () => {
    const model = buildShellModel({
      locale: "en",
      principal: { active: true, roles: ["manager"] },
    });

    expect(model.navigation.map(({ id }) => id)).toContain("manager-operations");
    expect(model.globalEntries.find(({ id }) => id === "capture")?.visible).toBe(false);
    expect(homeHrefForPrincipal("en", { active: true, roles: ["manager"] })).toBe(
      "/en/manager/operations",
    );
  });

  it("shows administration and health without manager decisions for an administrator", () => {
    const model = buildShellModel({
      locale: "en",
      principal: { active: true, roles: ["system_administrator"] },
    });

    expect(model.navigation.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["administration", "health"]),
    );
    expect(model.navigation.map(({ id }) => id)).not.toContain("manager-operations");
    expect(homeHrefForPrincipal("en", { active: true, roles: ["system_administrator"] })).toBe(
      "/en/admin/operations",
    );
  });

  it("keeps the employee Home route as the daily overview", () => {
    expect(homeHrefForPrincipal("ar", employee)).toBe("/ar/my-work");
    expect(
      buildShellModel({ locale: "en", principal: employee }).navigation.find(
        ({ id }) => id === "today",
      )?.href,
    ).toBe("/en/my-work");
  });

  it("does not turn Project coordination into manager evaluation authority", () => {
    const model = buildShellModel({
      contribution: { canContribute: true, isProjectOwner: true, isWorkstreamOwner: true },
      locale: "en",
      principal: employee,
    });

    expect(model.navigation.map(({ id }) => id)).not.toContain("manager-operations");
    expect(model.globalEntries.find(({ id }) => id === "capture")?.visible).toBe(true);
  });

  it("preserves the safe path, query, and fragment when switching locale", () => {
    expect(
      localeSwitchHref({
        currentHref: "/en/projects/123?view=board&item=456#details",
        locale: "ar",
      }),
    ).toBe("/ar/projects/123?view=board&item=456#details");
  });

  it("keeps mobile navigation compact and exposes remaining destinations in overflow", () => {
    const model = buildShellModel({ locale: "ar", principal: employee });

    expect(model.mobilePrimary.map(({ id }) => id)).toEqual([
      "today",
      "work",
      "projects",
      "research",
      "evaluation",
    ]);
    expect(model.mobileOverflow.map(({ id }) => id)).toEqual(["insights", "settings", "help"]);
  });
});
