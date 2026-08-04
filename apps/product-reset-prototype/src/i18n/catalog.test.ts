import { describe, expect, it } from "vitest";

import { catalogs, type CatalogKey } from "./catalog";

describe("prototype catalogs", () => {
  it("keeps Arabic and English keys complete and aligned", () => {
    expect(Object.keys(catalogs.ar).sort()).toEqual(Object.keys(catalogs.en).sort());
  });

  it("contains required navigation, state, and accessibility labels", () => {
    for (const key of [
      "nav.myWork",
      "nav.inbox",
      "nav.projects",
      "nav.evidence",
      "nav.readiness",
      "nav.operations",
      "persona.employee",
      "persona.manager",
      "prototype.synthetic",
      "status.in_progress",
      "health.at_risk",
      "verification.source_supported",
      "execution.agent_generated",
      "a11y.closePanel",
      "a11y.openNavigation",
    ] satisfies readonly CatalogKey[]) {
      expect(catalogs.ar[key]).toBeTruthy();
      expect(catalogs.en[key]).toBeTruthy();
    }
  });
});
