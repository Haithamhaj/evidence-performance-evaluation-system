import { describe, expect, it } from "vitest";

import {
  AnalysisSourceReferenceSchema,
  ComparisonAnalysisOutputSchema,
  ManagerReadinessSummarySchema,
  ReadinessAnalysisOutputSchema,
  ReadinessLifecycleStateSchema,
  ReadinessParticipantDetailSchema,
  ReviewMaterialClassificationSchema,
} from "./document-analysis.js";

const sourceReference = "document-version:00000000-0000-4000-8000-000000000001";

describe("document analysis contracts", () => {
  it("keeps opaque source references portable without accepting URLs or secret labels", () => {
    for (const accepted of [
      "document-version:00000000-0000-4000-8000-000000000001",
      "mytoken:123",
      "source_name:01ARZ3NDEKTSV4RRFFQ69G5FAV",
    ]) {
      expect(AnalysisSourceReferenceSchema.parse(accepted)).toBe(accepted);
    }
    for (const rejected of [
      "https:123",
      "api-key:123",
      "source-token:123",
      "credential:00000000-0000-4000-8000-000000000001",
    ]) {
      expect(() => AnalysisSourceReferenceSchema.parse(rejected)).toThrow();
    }
  });

  it("publishes only the approved readiness lifecycle states", () => {
    expect(ReadinessLifecycleStateSchema.options).toEqual([
      "draft",
      "incomplete",
      "ready_for_criteria_generation",
      "criteria_approved",
      "revision_required",
      "superseded",
    ]);
  });

  it("keeps the manager projection operational-only", () => {
    expect(ManagerReadinessSummarySchema.parse({ state: "needs_attention" })).toEqual({
      state: "needs_attention",
    });
    for (const forbidden of ["percentage", "missingItems", "trend", "rank", "rating"]) {
      expect(() =>
        ManagerReadinessSummarySchema.parse({ state: "ready", [forbidden]: 1 }),
      ).toThrow();
    }
  });

  it("keeps participant detail source-bound without a readiness percentage", () => {
    const detail = {
      readinessCheckId: "00000000-0000-4000-8000-000000000002",
      documentVersionId: "00000000-0000-4000-8000-000000000003",
      lifecycleState: "incomplete",
      missingItems: [
        {
          templateSectionKey: "definition_of_success",
          missingItem: "A verifiable success condition",
          whyItMatters: "Criteria must remain grounded in the approved source.",
          correctionInstruction: "Update the source document with a verifiable condition.",
          sourceReferences: [sourceReference],
        },
      ],
      sourceReferences: [sourceReference],
      analyzedAt: "2026-07-17T12:00:00.000Z",
    };
    expect(ReadinessParticipantDetailSchema.parse(detail)).toEqual(detail);
    expect(() => ReadinessParticipantDetailSchema.parse({ ...detail, percentage: 60 })).toThrow();
  });

  it("requires missing-item context and exact source references", () => {
    expect(
      ReadinessAnalysisOutputSchema.parse({
        state: "incomplete",
        missingItems: [
          {
            templateSectionKey: "scope_and_boundaries",
            missingItem: "Explicit boundaries",
            whyItMatters: "The approved scope cannot be inferred.",
            correctionInstruction: "Add explicit in-scope and out-of-scope boundaries.",
            sourceReferences: [sourceReference],
          },
        ],
        sourceReferences: [sourceReference],
      }),
    ).toMatchObject({ state: "incomplete" });
    expect(() =>
      ReadinessAnalysisOutputSchema.parse({
        state: "ready_for_criteria_generation",
        missingItems: [],
        sourceReferences: ["https://example.invalid/private"],
      }),
    ).toThrow();
    expect(() =>
      ReadinessAnalysisOutputSchema.parse({
        state: "incomplete",
        missingItems: [],
        sourceReferences: [sourceReference],
      }),
    ).toThrow();
    expect(() =>
      ReadinessAnalysisOutputSchema.parse({
        state: "ready_for_criteria_generation",
        missingItems: [
          {
            templateSectionKey: "scope",
            missingItem: "Scope",
            whyItMatters: "Grounding",
            correctionInstruction: "Add scope",
            sourceReferences: [sourceReference],
          },
        ],
        sourceReferences: [sourceReference],
      }),
    ).toThrow();
  });

  it("retains both sides of a material comparison", () => {
    expect(
      ComparisonAnalysisOutputSchema.parse({
        classification: "material_scope_or_goal_change",
        impactExplanation: "The target outcome changed.",
        beforeSourceReferences: ["document-version:00000000-0000-4000-8000-000000000004"],
        afterSourceReferences: ["document-version:00000000-0000-4000-8000-000000000005"],
      }),
    ).toMatchObject({ classification: "material_scope_or_goal_change" });
    expect(() =>
      ComparisonAnalysisOutputSchema.parse({
        classification: "editorial",
        impactExplanation: " padded",
        beforeSourceReferences: [sourceReference],
        afterSourceReferences: [sourceReference],
      }),
    ).toThrow();
    expect(
      ComparisonAnalysisOutputSchema.parse({
        classification: "routine_execution_update",
        impactExplanation: "تحديث داخلي على المسار /repo/src مع بقاء النطاق",
        beforeSourceReferences: [sourceReference],
        afterSourceReferences: [sourceReference],
      }),
    ).toMatchObject({ classification: "routine_execution_update" });
  });

  it("requires an append-only human confirmation or correction reason", () => {
    expect(
      ReviewMaterialClassificationSchema.parse({
        action: "confirm",
        reason: "The cited change matches the source versions.",
      }),
    ).toMatchObject({ action: "confirm" });
    expect(
      ReviewMaterialClassificationSchema.parse({
        action: "correct",
        classification: "editorial",
        reason: "Only spelling and formatting changed.",
      }),
    ).toMatchObject({ classification: "editorial" });
    expect(() =>
      ReviewMaterialClassificationSchema.parse({
        action: "correct",
        reason: "A classification is required.",
      }),
    ).toThrow();
  });
});
