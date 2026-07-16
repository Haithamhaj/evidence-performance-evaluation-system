import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import englishRubricJson from "./v1.en.json" with { type: "json" };

import { RubricContentSchema } from "./rubric-schema.ts";
import {
  assertArabicRubricActivatable,
  buildArabicReviewInventory,
  compareLocaleStructure,
  type ArabicRubricDraft,
} from "./translation-approval.ts";

const englishRubric = RubricContentSchema.parse(englishRubricJson);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function arabicContentFromEnglish(): ArabicRubricDraft["content"] {
  return {
    ...structuredClone(englishRubric),
    locale: "ar",
  };
}

function approvedDisposition(
  reviewerKind: "subject_matter" | "employee_comprehension",
  reviewerUserId = reviewerKind === "subject_matter"
    ? "00000000-0000-4000-8000-000000000161"
    : "00000000-0000-4000-8000-000000000162",
): import("./translation-approval.ts").ReviewDisposition {
  return {
    decision: "approved",
    reviewer: { actorKind: "human", reviewerKind, reviewerUserId },
    reviewedAt: "2026-07-16T09:00:00.000Z",
    note: "Direct human review completed.",
  };
}

function makeArabicRubric(
  options: Readonly<{
    unresolvedIds?: readonly string[];
    machineReviewerId?: string;
    incompleteCheck?: keyof ArabicRubricDraft["reviewChecks"];
  }> = {},
): ArabicRubricDraft {
  const content = arabicContentFromEnglish();
  const reviewItems = buildArabicReviewInventory(englishRubric, content).map((item) => ({
    ...item,
    semanticNote: "Meaning and adjacent distinctions reviewed directly.",
    subjectMatterDisposition: approvedDisposition("subject_matter"),
    employeeComprehensionDisposition: approvedDisposition("employee_comprehension"),
  }));
  const unresolved = new Set(options.unresolvedIds ?? []);
  for (const item of reviewItems) {
    if (unresolved.has(item.id)) {
      item.subjectMatterDisposition = {
        decision: "unresolved",
        reviewer: null,
        reviewedAt: null,
        note: "Requires direct human review.",
      };
    }
    if (item.id === options.machineReviewerId) {
      item.subjectMatterDisposition = {
        decision: "approved",
        reviewer: {
          actorKind: "machine",
          reviewerKind: "subject_matter",
          reviewerUserId: "00000000-0000-4000-8000-000000000163",
        },
        reviewedAt: "2026-07-16T09:00:00.000Z",
        note: "Machine review is not eligible.",
      };
    }
  }

  const reviewChecks = {
    rtlLayout: {
      subjectMatterDisposition: approvedDisposition("subject_matter"),
      employeeComprehensionDisposition: approvedDisposition("employee_comprehension"),
      evidenceRefs: ["tests/e2e/rtl-focus.spec.ts", "tests/e2e/locale-shell.spec.ts"],
    },
    mixedTerminology: {
      subjectMatterDisposition: approvedDisposition("subject_matter"),
      employeeComprehensionDisposition: approvedDisposition("employee_comprehension"),
      evidenceRefs: [
        "tests/e2e/mixed-direction.spec.ts",
        "tests/ai-evals/fixtures/mixed-direction.json",
      ],
    },
    gulfArabicExamples: {
      subjectMatterDisposition: approvedDisposition("subject_matter"),
      employeeComprehensionDisposition: approvedDisposition("employee_comprehension"),
      evidenceRefs: [
        "tests/ai-evals/fixtures/gulf-dialect.json",
        "tests/ai-evals/fixtures/audio/gulf-synthetic.wav",
      ],
    },
    levantineArabicExamples: {
      subjectMatterDisposition: approvedDisposition("subject_matter"),
      employeeComprehensionDisposition: approvedDisposition("employee_comprehension"),
      evidenceRefs: [
        "tests/ai-evals/fixtures/levantine-dialect.json",
        "tests/ai-evals/fixtures/audio/levantine-synthetic.wav",
      ],
    },
    adjacentAnchors: {
      subjectMatterDisposition: approvedDisposition("subject_matter"),
      employeeComprehensionDisposition: approvedDisposition("employee_comprehension"),
      evidenceRefs: reviewItems.filter(({ id }) => id.includes(".anchor.")).map(({ id }) => id),
    },
  } satisfies ArabicRubricDraft["reviewChecks"];

  if (options.incompleteCheck) {
    reviewChecks[options.incompleteCheck] = {
      subjectMatterDisposition: {
        decision: "unresolved",
        reviewer: null,
        reviewedAt: null,
        note: "Requires direct human review.",
      },
      employeeComprehensionDisposition: approvedDisposition("employee_comprehension"),
      evidenceRefs: [],
    };
  }

  return {
    status: "draft",
    provenance: {
      actorKind: "machine",
      label: "AI-assisted recommended Arabic draft requiring direct human review",
    },
    content,
    reviewItems,
    reviewChecks,
  };
}

describe("Arabic rubric translation approval", () => {
  it("requires exact English IDs, version, source hash, order, and content counts", () => {
    expect(compareLocaleStructure(englishRubric, makeArabicRubric().content)).toEqual([]);

    const changed = makeArabicRubric().content;
    changed.employeeCriteria[0]!.id = "PPB-99";
    expect(compareLocaleStructure(englishRubric, changed)).toContain(
      "RUBRIC_AR_STABLE_ID_MISMATCH:employeeCriteria[0]",
    );
  });

  it("builds the exact T010 semantic inventory", () => {
    const inventory = buildArabicReviewInventory(englishRubric, makeArabicRubric().content);
    expect(inventory).toHaveLength(292);
    expect(new Set(inventory.map(({ id }) => id)).size).toBe(292);
    expect(inventory.filter(({ id }) => /\.anchor\.[1-5]$/u.test(id))).toHaveLength(90);
    expect(inventory.filter(({ id }) => id.startsWith("bias-guidance."))).toHaveLength(15);
    expect(inventory.every(({ version }) => version === "1")).toBe(true);
    expect(
      inventory.every(
        ({ arabicContentHash, englishSourceHash }) =>
          /^[a-f0-9]{64}$/u.test(arabicContentHash) && /^[a-f0-9]{64}$/u.test(englishSourceHash),
      ),
    ).toBe(true);
  });

  it("refuses Arabic activation while any semantic item is unresolved", () => {
    const draft = makeArabicRubric({ unresolvedIds: ["EED-03.anchor.4"] });
    expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
      "RUBRIC_AR_SEMANTIC_REVIEW_REQUIRED:EED-03.anchor.4",
    );
  });

  it.each(["subjectMatterDisposition", "employeeComprehensionDisposition"] as const)(
    "rejects a missing or non-approved %s",
    (dispositionKey) => {
      const draft = makeArabicRubric();
      draft.reviewItems[0]![dispositionKey] = {
        decision: "rejected",
        reviewer: null,
        reviewedAt: null,
        note: "Meaning needs revision.",
      };
      expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
        "RUBRIC_AR_SEMANTIC_REVIEW_REQUIRED:section.PPB.title",
      );
    },
  );

  it("rejects AI and machine-translation reviewers even when marked approved", () => {
    const draft = makeArabicRubric({ machineReviewerId: "PPB-01.definition" });
    expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
      "RUBRIC_AR_HUMAN_REVIEW_REQUIRED:PPB-01.definition",
    );
  });

  it.each([
    [
      "missing identity",
      (draft: Record<string, unknown>) => {
        const reviewItems = draft.reviewItems as Array<Record<string, unknown>>;
        const disposition = reviewItems[0]!.subjectMatterDisposition as Record<string, unknown>;
        const reviewer = disposition.reviewer as Record<string, unknown>;
        delete reviewer.reviewerUserId;
      },
    ],
    [
      "invalid reviewer UUID",
      (draft: Record<string, unknown>) => {
        const reviewItems = draft.reviewItems as Array<Record<string, unknown>>;
        const disposition = reviewItems[0]!.subjectMatterDisposition as Record<string, unknown>;
        const reviewer = disposition.reviewer as Record<string, unknown>;
        reviewer.reviewerUserId = "not-a-uuid";
      },
    ],
    [
      "empty timestamp",
      (draft: Record<string, unknown>) => {
        const reviewItems = draft.reviewItems as Array<Record<string, unknown>>;
        const disposition = reviewItems[0]!.subjectMatterDisposition as Record<string, unknown>;
        disposition.reviewedAt = "";
      },
    ],
    [
      "non-UTC timestamp",
      (draft: Record<string, unknown>) => {
        const reviewItems = draft.reviewItems as Array<Record<string, unknown>>;
        const disposition = reviewItems[0]!.subjectMatterDisposition as Record<string, unknown>;
        disposition.reviewedAt = "2026-07-16T12:00:00.000+03:00";
      },
    ],
    [
      "blank note",
      (draft: Record<string, unknown>) => {
        const reviewItems = draft.reviewItems as Array<Record<string, unknown>>;
        const disposition = reviewItems[0]!.subjectMatterDisposition as Record<string, unknown>;
        disposition.note = "   ";
      },
    ],
    [
      "blank semantic note",
      (draft: Record<string, unknown>) => {
        const reviewItems = draft.reviewItems as Array<Record<string, unknown>>;
        reviewItems[0]!.semanticNote = "   ";
      },
    ],
    [
      "missing item disposition",
      (draft: Record<string, unknown>) => {
        const reviewItems = draft.reviewItems as Array<Record<string, unknown>>;
        delete reviewItems[0]!.employeeComprehensionDisposition;
      },
    ],
    [
      "missing cross-cutting check",
      (draft: Record<string, unknown>) => {
        const reviewChecks = draft.reviewChecks as Record<string, unknown>;
        delete reviewChecks.rtlLayout;
      },
    ],
    [
      "malformed reviewer",
      (draft: Record<string, unknown>) => {
        const reviewItems = draft.reviewItems as Array<Record<string, unknown>>;
        const disposition = reviewItems[0]!.subjectMatterDisposition as Record<string, unknown>;
        disposition.reviewer = "human";
      },
    ],
    [
      "schema-invalid value",
      (draft: Record<string, unknown>) => {
        draft.status = "approved";
      },
    ],
  ] as const)("returns a stable guard error for malformed untrusted input: %s", (_name, mutate) => {
    const draft = structuredClone(makeArabicRubric()) as unknown as Record<string, unknown>;
    mutate(draft);
    expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
      "RUBRIC_AR_DRAFT_INVALID",
    );
  });

  it("requires separate human identities for the two protected review gates", () => {
    const draft = makeArabicRubric();
    draft.reviewItems[0]!.employeeComprehensionDisposition.reviewer!.reviewerUserId =
      draft.reviewItems[0]!.subjectMatterDisposition.reviewer!.reviewerUserId;
    expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
      "RUBRIC_AR_DISTINCT_HUMAN_REVIEWERS_REQUIRED:section.PPB.title",
    );
  });

  it("requires globally disjoint human identities across the two protected review gates", () => {
    const draft = makeArabicRubric();
    const subjectMatterReviewerId =
      draft.reviewItems[0]!.subjectMatterDisposition.reviewer!.reviewerUserId;
    const employeeComprehensionReviewerId =
      draft.reviewItems[0]!.employeeComprehensionDisposition.reviewer!.reviewerUserId;

    draft.reviewItems[1]!.subjectMatterDisposition.reviewer!.reviewerUserId =
      employeeComprehensionReviewerId;
    draft.reviewItems[1]!.employeeComprehensionDisposition.reviewer!.reviewerUserId =
      subjectMatterReviewerId;

    expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
      "RUBRIC_AR_REVIEWER_GATES_NOT_SEPARATE",
    );
  });

  it("allows multiple human identities within one protected reviewer-kind gate", () => {
    const draft = makeArabicRubric();
    draft.reviewItems[1]!.subjectMatterDisposition.reviewer!.reviewerUserId =
      "00000000-0000-4000-8000-000000000164";
    draft.reviewChecks.rtlLayout.subjectMatterDisposition.reviewer!.reviewerUserId =
      "00000000-0000-4000-8000-000000000165";

    expect(() => assertArabicRubricActivatable(englishRubric, draft)).not.toThrow();
  });

  it("requires the exact reviewer kind for each protected review gate", () => {
    const draft = makeArabicRubric();
    draft.reviewItems[0]!.subjectMatterDisposition.reviewer!.reviewerKind =
      "employee_comprehension";
    expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
      "RUBRIC_AR_HUMAN_REVIEW_REQUIRED:section.PPB.title",
    );
  });

  it.each([
    "rtlLayout",
    "mixedTerminology",
    "gulfArabicExamples",
    "levantineArabicExamples",
    "adjacentAnchors",
  ] as const)("rejects incomplete %s review", (incompleteCheck) => {
    const draft = makeArabicRubric({ incompleteCheck });
    expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
      `RUBRIC_AR_REQUIRED_REVIEW_INCOMPLETE:${incompleteCheck}`,
    );
  });

  it.each([
    ["rtlLayout", ["irrelevant"]],
    ["mixedTerminology", ["tests/e2e/mixed-direction.spec.ts"]],
    ["gulfArabicExamples", ["tests/ai-evals/fixtures/audio/gulf-synthetic.wav", "irrelevant"]],
    [
      "levantineArabicExamples",
      [
        "tests/ai-evals/fixtures/levantine-dialect.json",
        "tests/ai-evals/fixtures/levantine-dialect.json",
      ],
    ],
  ] as const)("rejects invalid bounded evidence for %s", (checkName, evidenceRefs) => {
    const draft = makeArabicRubric();
    draft.reviewChecks[checkName].evidenceRefs = [...evidenceRefs];
    expect(() => assertArabicRubricActivatable(englishRubric, draft)).toThrowError(
      `RUBRIC_AR_REQUIRED_EVIDENCE_INVALID:${checkName}`,
    );
  });

  it("requires adjacent-anchor evidence to cover the complete 90-anchor inventory exactly once", () => {
    const missing = makeArabicRubric();
    missing.reviewChecks.adjacentAnchors.evidenceRefs.pop();
    expect(() => assertArabicRubricActivatable(englishRubric, missing)).toThrowError(
      "RUBRIC_AR_REQUIRED_EVIDENCE_INVALID:adjacentAnchors",
    );

    const duplicate = makeArabicRubric();
    duplicate.reviewChecks.adjacentAnchors.evidenceRefs[89] =
      duplicate.reviewChecks.adjacentAnchors.evidenceRefs[0]!;
    expect(() => assertArabicRubricActivatable(englishRubric, duplicate)).toThrowError(
      "RUBRIC_AR_REQUIRED_EVIDENCE_INVALID:adjacentAnchors",
    );

    const unnormalized = makeArabicRubric();
    unnormalized.reviewChecks.adjacentAnchors.evidenceRefs[0] = ` ${unnormalized.reviewChecks.adjacentAnchors.evidenceRefs[0]} `;
    expect(() => assertArabicRubricActivatable(englishRubric, unnormalized)).toThrowError(
      "RUBRIC_AR_REQUIRED_EVIDENCE_INVALID:adjacentAnchors",
    );
  });

  it("rejects inventory tampering and stale Arabic hashes", () => {
    const missing = makeArabicRubric();
    missing.reviewItems.pop();
    expect(() => assertArabicRubricActivatable(englishRubric, missing)).toThrowError(
      "RUBRIC_AR_REVIEW_INVENTORY_MISMATCH",
    );

    const stale = makeArabicRubric();
    stale.reviewItems[0]!.arabicContentHash = "0".repeat(64);
    expect(() => assertArabicRubricActivatable(englishRubric, stale)).toThrowError(
      "RUBRIC_AR_REVIEW_INVENTORY_MISMATCH",
    );
  });

  it("proves the committed canonical draft cannot activate", async () => {
    const { draftArabicRubric } = await import("./translation-approval.ts");
    expect(draftArabicRubric.status).toBe("draft");
    expect(
      draftArabicRubric.reviewItems.every(
        ({ subjectMatterDisposition }) => subjectMatterDisposition.decision === "unresolved",
      ),
    ).toBe(true);
    expect(() => assertArabicRubricActivatable(englishRubric, draftArabicRubric)).toThrowError(
      /RUBRIC_AR_SEMANTIC_REVIEW_REQUIRED/u,
    );
  });

  it("exports the exact unresolved human-review inventory and stop package", () => {
    const result = spawnSync(process.execPath, ["scripts/export-rubric-review.mjs"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "ARABIC RUBRIC REVIEW EXPORT: 292 semantic items, 292 unresolved",
    );
    const review = readFileSync(
      path.join(repositoryRoot, "docs/rubric/arabic-v1-review.md"),
      "utf8",
    );
    expect(review).toContain("Status: **INACTIVE — HUMAN APPROVAL REQUIRED**");
    expect(review).toContain(
      "English root source hash: `d5b9c96b0849be1f94e901333f5e42d95f7fabe719969ba8ee2cda5cdf5d67a6`",
    );
    expect(review.match(/^### `[^`]+`$/gmu)).toHaveLength(292);
    expect(review.match(/Subject-matter disposition: `UNRESOLVED`/gu)).toHaveLength(292);
    expect(review.match(/Employee-comprehension disposition: `UNRESOLVED`/gu)).toHaveLength(292);
    expect(review).toContain("## Protected human inputs still required");
    expect(review).toContain("## Cross-cutting evidence contracts");
    expect(review).toContain("tests/ai-evals/fixtures/audio/gulf-synthetic.wav");
    expect(review).toContain("tests/ai-evals/fixtures/audio/levantine-synthetic.wav");
    expect(review).toContain("## Known draft language flags requiring human decision");
    for (const id of [
      "bias-guidance.3",
      "bias-guidance.4",
      "bias-guidance.13",
      "PPB-01.anchor.3",
      "MGR-03.anchor.1",
      "MGR-02.anchor.5",
    ]) {
      expect(review).toContain(`\`${id}\``);
    }
    expect(review).toContain("## Stop package");
  });
});
