import { describe, expect, it } from "vitest";

const ledgerValidator =
  await import("../../scripts/validate-ai-native-route-retirement-ledger.mjs").catch(() => null);

const routes = ["/", "/projects"];
const capabilityIds = new Set(["CAP-006", "CAP-013"]);
const validLedger = [
  {
    schemaVersion: 1,
    currentRoute: "/",
    purpose: "Current home route.",
    capabilityIds: ["CAP-013"],
    targetPhase: "P1",
    targetSurface: "today",
    parityEvidenceRequired: "Focused route acceptance verifies the replacement.",
    removalApproval: "Product Owner approval after parity evidence.",
    rollback: "Restore this retained route from the approved release artifact.",
    disposition: "REPLACE_AFTER_PARITY",
  },
  {
    schemaVersion: 1,
    currentRoute: "/projects",
    purpose: "Current project route.",
    capabilityIds: ["CAP-006"],
    targetPhase: "P3",
    targetSurface: "projects",
    parityEvidenceRequired: "Focused route acceptance verifies the replacement.",
    removalApproval: "Product Owner approval after parity evidence.",
    rollback: "Restore this retained route from the approved release artifact.",
    disposition: "RETAIN",
  },
] as const;

function requireValidator() {
  expect(ledgerValidator).not.toBeNull();
  if (!ledgerValidator) throw new Error("route retirement ledger validator is unavailable");
  return ledgerValidator;
}

describe("AI-native route retirement ledger", () => {
  it("accepts a complete ledger that links every current route to an engine capability", () => {
    const { validateRouteRetirementLedger } = requireValidator();

    expect(() =>
      validateRouteRetirementLedger({ routes, capabilityIds, ledger: validLedger }),
    ).not.toThrow();
  });

  it("rejects unlisted routes, missing capability links, and premature removal", () => {
    const { validateRouteRetirementLedger } = requireValidator();

    expect(() =>
      validateRouteRetirementLedger({ routes, capabilityIds, ledger: validLedger.slice(0, 1) }),
    ).toThrow(/unlisted current route/iu);
    expect(() =>
      validateRouteRetirementLedger({
        routes,
        capabilityIds,
        ledger: [{ ...validLedger[0], capabilityIds: ["CAP-999"] }, validLedger[1]],
      }),
    ).toThrow(/capability link/iu);
    expect(() =>
      validateRouteRetirementLedger({
        routes,
        capabilityIds,
        ledger: [{ ...validLedger[0], disposition: "REMOVE" }, validLedger[1]],
      }),
    ).toThrow(/premature.*remove/iu);
  });
});
