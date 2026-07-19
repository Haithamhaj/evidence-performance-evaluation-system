import { ProgressContractDraftService } from "@evaluation/projects";
import { describe, expect, it } from "vitest";

import { ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProgressContractDraftsController } from "./progress-contract-drafts.controller.js";
import { ProjectsAuthenticationGuard } from "./projects-authentication.guard.js";

const GUARDS_METADATA = "__guards__";
const METHOD_METADATA = "method";
const PATH_METADATA = "path";

describe("ProgressContractDraftsController metadata", () => {
  it("declares authentication and Project policy protection on every endpoint", () => {
    expect(Reflect.getMetadata(PATH_METADATA, ProgressContractDraftsController)).toBe(
      "api/v1/projects/:projectId/progress-contract-drafts",
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, ProgressContractDraftsController)).toContain(
      ProjectsAuthenticationGuard,
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProgressContractDraftsController.prototype.create),
    ).toContain(ProjectPolicyGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProgressContractDraftsController.prototype.latest),
    ).toContain(ProjectPolicyGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProgressContractDraftsController.prototype.get),
    ).toContain(ProjectPolicyGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProgressContractDraftsController.prototype.revise),
    ).toContain(ProjectPolicyGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ProgressContractDraftsController.prototype.applyRevision,
      ),
    ).toContain(ProjectPolicyGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProgressContractDraftsController.prototype.reject),
    ).toContain(ProjectPolicyGuard);
    expect(
      Reflect.getMetadata(METHOD_METADATA, ProgressContractDraftsController.prototype.get),
    ).toBe(0);
    expect(
      Reflect.getMetadata(METHOD_METADATA, ProgressContractDraftsController.prototype.latest),
    ).toBe(0);
    expect(
      Reflect.getMetadata(PATH_METADATA, ProgressContractDraftsController.prototype.latest),
    ).toBe("/");
    expect(
      Reflect.getMetadata(PATH_METADATA, ProgressContractDraftsController.prototype.revise),
    ).toBe(":requestId/revisions");
    expect(Reflect.getMetadata("self:paramtypes", ProgressContractDraftsController)).toContainEqual(
      { index: 0, param: ProgressContractDraftService },
    );
  });
});
