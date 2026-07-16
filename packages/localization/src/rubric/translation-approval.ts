import { createHash } from "node:crypto";

import { z } from "zod";

import draftArabicRubricJson from "./v1.ar.json" with { type: "json" };

import { CriterionSchema, ManagerCriterionSchema } from "./rubric-schema.ts";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const ArabicRubricContentSchema = z
  .object({
    version: z.literal("1"),
    locale: z.literal("ar"),
    sourceHash: Sha256Schema,
    sections: z
      .array(
        z
          .object({
            id: z.string(),
            title: z.string().min(1),
            weight: z.number().int().min(0).max(100),
          })
          .strict(),
      )
      .length(4),
    employeeCriteria: z.array(CriterionSchema).length(12),
    projectContribution: CriterionSchema,
    managerCriteria: z.array(ManagerCriterionSchema).length(5),
    biasGuidance: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type ArabicRubricContent = z.infer<typeof ArabicRubricContentSchema>;

const ReviewerSchema = z
  .object({
    actorKind: z.enum(["human", "machine"]),
    reviewerKind: z.enum(["subject_matter", "employee_comprehension"]),
    reviewerUserId: z.uuid(),
  })
  .strict();

const ReviewDispositionSchema = z
  .object({
    decision: z.enum(["unresolved", "approved", "rejected"]),
    reviewer: ReviewerSchema.nullable(),
    reviewedAt: z.iso.datetime({ offset: false }).nullable(),
    note: z.string().trim().min(1),
  })
  .strict();

export type ReviewDisposition = z.infer<typeof ReviewDispositionSchema>;

const ReviewItemSchema = z
  .object({
    id: z.string().min(1),
    version: z.literal("1"),
    englishSourceHash: Sha256Schema,
    arabicContentHash: Sha256Schema,
    semanticNote: z.string().trim().min(1),
    subjectMatterDisposition: ReviewDispositionSchema,
    employeeComprehensionDisposition: ReviewDispositionSchema,
  })
  .strict();

const ReviewCheckSchema = z
  .object({
    subjectMatterDisposition: ReviewDispositionSchema,
    employeeComprehensionDisposition: ReviewDispositionSchema,
    evidenceRefs: z.array(z.string().min(1)),
  })
  .strict();

export const ArabicRubricDraftSchema = z
  .object({
    status: z.literal("draft"),
    provenance: z
      .object({
        actorKind: z.literal("machine"),
        label: z.string().min(1),
      })
      .strict(),
    content: ArabicRubricContentSchema,
    reviewItems: z.array(ReviewItemSchema),
    reviewChecks: z
      .object({
        rtlLayout: ReviewCheckSchema,
        mixedTerminology: ReviewCheckSchema,
        gulfArabicExamples: ReviewCheckSchema,
        levantineArabicExamples: ReviewCheckSchema,
        adjacentAnchors: ReviewCheckSchema,
      })
      .strict(),
  })
  .strict();

export type ArabicRubricDraft = z.infer<typeof ArabicRubricDraftSchema>;
export type ArabicReviewItem = ArabicRubricDraft["reviewItems"][number];

interface TextInventoryEntry {
  readonly id: string;
  readonly text: string;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function collectCriterionText(
  criterion:
    | import("./rubric-schema.ts").RubricContent["employeeCriteria"][number]
    | import("./rubric-schema.ts").RubricContent["projectContribution"],
): TextInventoryEntry[] {
  const entries: TextInventoryEntry[] = [{ id: `${criterion.id}.title`, text: criterion.title }];
  for (const field of [
    "assessmentBasis",
    "definition",
    "whyItMatters",
    "included",
    "excluded",
    "purpose",
    "evidenceGuidance",
  ] as const) {
    const text = criterion[field];
    if (text !== undefined) entries.push({ id: `${criterion.id}.${field}`, text });
  }
  entries.push(
    ...criterion.anchors.map(({ rating, text }) => ({
      id: `${criterion.id}.anchor.${rating}`,
      text,
    })),
  );
  for (const [field, values] of [
    ["prohibitedInputs", criterion.prohibitedInputs],
    ["requiredContextReview", criterion.requiredContextReview],
    ["example", criterion.examples],
  ] as const) {
    if (values === undefined) continue;
    entries.push(
      ...values.map((text, index) => ({ id: `${criterion.id}.${field}.${index + 1}`, text })),
    );
  }
  return entries;
}

function rubricTextInventory(
  rubric: import("./rubric-schema.ts").RubricContent | ArabicRubricContent,
): readonly TextInventoryEntry[] {
  return [
    ...rubric.sections.map(({ id, title }) => ({ id: `section.${id}.title`, text: title })),
    ...rubric.employeeCriteria.flatMap(collectCriterionText),
    ...collectCriterionText(rubric.projectContribution),
    ...rubric.managerCriteria.flatMap((criterion) => [
      { id: `${criterion.id}.title`, text: criterion.title },
      { id: `${criterion.id}.definition`, text: criterion.definition },
      ...criterion.anchors.map(({ rating, text }) => ({
        id: `${criterion.id}.anchor.${rating}`,
        text,
      })),
      { id: `${criterion.id}.commentPrompt`, text: criterion.commentPrompt },
    ]),
    ...rubric.biasGuidance.map((text, index) => ({
      id: `bias-guidance.${index + 1}`,
      text,
    })),
  ];
}

function compareOrderedValues(
  differences: string[],
  scope: string,
  english: readonly (string | number)[],
  arabic: readonly (string | number)[],
): void {
  if (english.length !== arabic.length) {
    differences.push(`RUBRIC_AR_COUNT_MISMATCH:${scope}`);
    return;
  }
  for (const [index, value] of english.entries()) {
    if (value !== arabic[index])
      differences.push(`RUBRIC_AR_STABLE_ID_MISMATCH:${scope}[${index}]`);
  }
}

export function compareLocaleStructure(
  english: import("./rubric-schema.ts").RubricContent,
  arabic: ArabicRubricContent,
): string[] {
  const differences: string[] = [];
  if (english.version !== arabic.version) differences.push("RUBRIC_AR_VERSION_MISMATCH");
  if (english.sourceHash !== arabic.sourceHash) differences.push("RUBRIC_AR_SOURCE_HASH_MISMATCH");
  compareOrderedValues(
    differences,
    "sections",
    english.sections.flatMap(({ id, weight }) => [id, weight]),
    arabic.sections.flatMap(({ id, weight }) => [id, weight]),
  );
  compareOrderedValues(
    differences,
    "employeeCriteria",
    english.employeeCriteria.flatMap(({ id, sectionId, internalWeight }) => [
      id,
      sectionId,
      internalWeight ?? -1,
    ]),
    arabic.employeeCriteria.flatMap(({ id, sectionId, internalWeight }) => [
      id,
      sectionId,
      internalWeight ?? -1,
    ]),
  );
  compareOrderedValues(
    differences,
    "employeeAnchors",
    english.employeeCriteria.flatMap(({ id, anchors }) =>
      anchors.map(({ rating }) => `${id}:${rating}`),
    ),
    arabic.employeeCriteria.flatMap(({ id, anchors }) =>
      anchors.map(({ rating }) => `${id}:${rating}`),
    ),
  );
  compareOrderedValues(
    differences,
    "projectContribution",
    [
      english.projectContribution.id,
      english.projectContribution.sectionId,
      english.projectContribution.sectionWeight ?? -1,
      ...english.projectContribution.anchors.map(({ rating }) => rating),
    ],
    [
      arabic.projectContribution.id,
      arabic.projectContribution.sectionId,
      arabic.projectContribution.sectionWeight ?? -1,
      ...arabic.projectContribution.anchors.map(({ rating }) => rating),
    ],
  );
  compareOrderedValues(
    differences,
    "managerCriteria",
    english.managerCriteria.flatMap(({ id, anchors }) => [
      id,
      ...anchors.map(({ rating }) => `${id}:${rating}`),
    ]),
    arabic.managerCriteria.flatMap(({ id, anchors }) => [
      id,
      ...anchors.map(({ rating }) => `${id}:${rating}`),
    ]),
  );
  const englishInventory = rubricTextInventory(english);
  const arabicInventory = rubricTextInventory(arabic);
  compareOrderedValues(
    differences,
    "semanticInventory",
    englishInventory.map(({ id }) => id),
    arabicInventory.map(({ id }) => id),
  );
  return [...new Set(differences)];
}

export function buildArabicReviewInventory(
  english: import("./rubric-schema.ts").RubricContent,
  arabic: ArabicRubricContent,
): ArabicReviewItem[] {
  const differences = compareLocaleStructure(english, arabic);
  if (differences.length > 0) throw new Error(differences.join(","));
  const arabicById = new Map(rubricTextInventory(arabic).map((entry) => [entry.id, entry.text]));
  return rubricTextInventory(english).map(({ id, text }) => ({
    id,
    version: "1",
    englishSourceHash: sha256(text),
    arabicContentHash: sha256(arabicById.get(id)!),
    semanticNote: "Requires direct human review of meaning and rating distinctions.",
    subjectMatterDisposition: {
      decision: "unresolved",
      reviewer: null,
      reviewedAt: null,
      note: "Requires direct human subject-matter review.",
    },
    employeeComprehensionDisposition: {
      decision: "unresolved",
      reviewer: null,
      reviewedAt: null,
      note: "Requires direct human employee-comprehension review.",
    },
  }));
}

function assertHumanApproval(
  itemId: string,
  disposition: ReviewDisposition,
  expectedKind: "subject_matter" | "employee_comprehension",
): void {
  if (disposition.decision !== "approved") {
    throw new Error(`RUBRIC_AR_SEMANTIC_REVIEW_REQUIRED:${itemId}`);
  }
  if (
    disposition.reviewer?.actorKind !== "human" ||
    disposition.reviewer.reviewerKind !== expectedKind ||
    disposition.reviewedAt === null
  ) {
    throw new Error(`RUBRIC_AR_HUMAN_REVIEW_REQUIRED:${itemId}`);
  }
}

export function assertArabicRubricActivatable(
  english: import("./rubric-schema.ts").RubricContent,
  untrustedCandidate: unknown,
): void {
  const parsedCandidate = ArabicRubricDraftSchema.safeParse(untrustedCandidate);
  if (!parsedCandidate.success) throw new Error("RUBRIC_AR_DRAFT_INVALID");
  const candidate = parsedCandidate.data;

  const structuralDifferences = compareLocaleStructure(english, candidate.content);
  if (structuralDifferences.length > 0) throw new Error(structuralDifferences[0]);

  const expectedInventory = buildArabicReviewInventory(english, candidate.content);
  if (candidate.reviewItems.length !== expectedInventory.length) {
    throw new Error("RUBRIC_AR_REVIEW_INVENTORY_MISMATCH");
  }
  const subjectMatterReviewerIds = new Set<string>();
  const employeeComprehensionReviewerIds = new Set<string>();
  for (const [index, expected] of expectedInventory.entries()) {
    const actual = candidate.reviewItems[index];
    if (
      actual === undefined ||
      actual.id !== expected.id ||
      actual.version !== expected.version ||
      actual.englishSourceHash !== expected.englishSourceHash ||
      actual.arabicContentHash !== expected.arabicContentHash
    ) {
      throw new Error("RUBRIC_AR_REVIEW_INVENTORY_MISMATCH");
    }
    assertHumanApproval(actual.id, actual.subjectMatterDisposition, "subject_matter");
    assertHumanApproval(
      actual.id,
      actual.employeeComprehensionDisposition,
      "employee_comprehension",
    );
    if (
      actual.subjectMatterDisposition.reviewer!.reviewerUserId ===
      actual.employeeComprehensionDisposition.reviewer!.reviewerUserId
    ) {
      throw new Error(`RUBRIC_AR_DISTINCT_HUMAN_REVIEWERS_REQUIRED:${actual.id}`);
    }
    subjectMatterReviewerIds.add(actual.subjectMatterDisposition.reviewer!.reviewerUserId);
    employeeComprehensionReviewerIds.add(
      actual.employeeComprehensionDisposition.reviewer!.reviewerUserId,
    );
  }

  const requiredEvidence: Readonly<
    Record<keyof ArabicRubricDraft["reviewChecks"], readonly string[]>
  > = {
    rtlLayout: ["tests/e2e/rtl-focus.spec.ts", "tests/e2e/locale-shell.spec.ts"],
    mixedTerminology: [
      "tests/e2e/mixed-direction.spec.ts",
      "tests/ai-evals/fixtures/mixed-direction.json",
    ],
    gulfArabicExamples: [
      "tests/ai-evals/fixtures/gulf-dialect.json",
      "tests/ai-evals/fixtures/audio/gulf-synthetic.wav",
    ],
    levantineArabicExamples: [
      "tests/ai-evals/fixtures/levantine-dialect.json",
      "tests/ai-evals/fixtures/audio/levantine-synthetic.wav",
    ],
    adjacentAnchors: expectedInventory
      .filter(({ id }) => /\.anchor\.[1-5]$/u.test(id))
      .map(({ id }) => id),
  };

  for (const [checkName, check] of Object.entries(candidate.reviewChecks)) {
    try {
      assertHumanApproval(checkName, check.subjectMatterDisposition, "subject_matter");
      assertHumanApproval(
        checkName,
        check.employeeComprehensionDisposition,
        "employee_comprehension",
      );
    } catch {
      throw new Error(`RUBRIC_AR_REQUIRED_REVIEW_INCOMPLETE:${checkName}`);
    }
    if (
      check.subjectMatterDisposition.reviewer!.reviewerUserId ===
      check.employeeComprehensionDisposition.reviewer!.reviewerUserId
    ) {
      throw new Error(`RUBRIC_AR_DISTINCT_HUMAN_REVIEWERS_REQUIRED:${checkName}`);
    }
    subjectMatterReviewerIds.add(check.subjectMatterDisposition.reviewer!.reviewerUserId);
    employeeComprehensionReviewerIds.add(
      check.employeeComprehensionDisposition.reviewer!.reviewerUserId,
    );
    const expected = requiredEvidence[checkName as keyof typeof requiredEvidence];
    if (
      check.evidenceRefs.length !== expected.length ||
      new Set(check.evidenceRefs).size !== check.evidenceRefs.length ||
      check.evidenceRefs.some(
        (reference, index) => reference.trim() !== reference || reference !== expected[index],
      )
    ) {
      throw new Error(`RUBRIC_AR_REQUIRED_EVIDENCE_INVALID:${checkName}`);
    }
  }

  if ([...subjectMatterReviewerIds].some((id) => employeeComprehensionReviewerIds.has(id))) {
    throw new Error("RUBRIC_AR_REVIEWER_GATES_NOT_SEPARATE");
  }
}

export const draftArabicRubric = ArabicRubricDraftSchema.parse(draftArabicRubricJson);
