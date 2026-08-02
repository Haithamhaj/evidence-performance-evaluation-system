import { describe, expect, it } from "vitest";

import { ProjectAnchorReader } from "./project-anchor-reader.js";

const employeeId = "00000000-0000-4000-8000-000000000201";
const sourceItemId = "00000000-0000-4000-8000-000000000202";
const projectId = "00000000-0000-4000-8000-000000000203";
const now = new Date("2026-08-02T09:00:00.000Z");

describe("ProjectAnchorReader public-boundary integration", () => {
  it("marks governed anchors stale from their bounded effective window", async () => {
    const reader = new ProjectAnchorReader(
      {
        async readProjectAnchors() {
          return [
            {
              projectId,
              kind: "EXPLICIT_USER_MAPPING",
              reference: `source-project-link:${sourceItemId}`,
              conflicts: false,
              effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
              effectiveUntil: new Date("2026-08-01T00:00:00.000Z"),
            },
            {
              projectId,
              kind: "PRIOR_EMPLOYEE_CORRECTION",
              reference: `source-link-correction:${sourceItemId}`,
              conflicts: false,
              effectiveFrom: new Date("2026-08-02T00:00:00.000Z"),
              effectiveUntil: null,
            },
          ];
        },
      },
      {
        async canAccessProject() {
          return true;
        },
      },
    );

    await expect(reader.read({ employeeId, sourceItemId, at: now })).resolves.toEqual([
      {
        projectId,
        accessible: true,
        anchors: [
          {
            anchor: {
              kind: "EXPLICIT_USER_MAPPING",
              reference: `source-project-link:${sourceItemId}`,
              conflicts: false,
            },
            current: false,
          },
          {
            anchor: {
              kind: "PRIOR_EMPLOYEE_CORRECTION",
              reference: `source-link-correction:${sourceItemId}`,
              conflicts: false,
            },
            current: true,
          },
        ],
      },
    ]);
  });

  it("carries Project authorization into the policy without reading Project tables", async () => {
    const reader = new ProjectAnchorReader(
      {
        async readProjectAnchors() {
          return [
            {
              projectId,
              kind: "GOVERNED_REPOSITORY_BINDING",
              reference: `repository-binding:${sourceItemId}`,
              conflicts: false,
              effectiveFrom: now,
              effectiveUntil: null,
            },
          ];
        },
      },
      {
        async canAccessProject() {
          return false;
        },
      },
    );

    await expect(reader.read({ employeeId, sourceItemId, at: now })).resolves.toMatchObject([
      { projectId, accessible: false },
    ]);
  });

  it("fails closed when an upstream reader supplies an ungoverned anchor kind", async () => {
    const reader = new ProjectAnchorReader(
      {
        async readProjectAnchors() {
          return [
            {
              projectId,
              kind: "MODEL_SIMILARITY",
              reference: `context-analysis:${sourceItemId}`,
              conflicts: false,
              effectiveFrom: now,
              effectiveUntil: null,
            },
          ];
        },
      },
      {
        async canAccessProject() {
          return true;
        },
      },
    );

    await expect(reader.read({ employeeId, sourceItemId, at: now })).rejects.toThrow(
      "Unsupported Project anchor kind",
    );
  });
});
