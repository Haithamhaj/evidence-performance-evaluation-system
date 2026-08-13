import { describe, expect, it } from "vitest";

import {
  CAPTURE_UNDERSTANDING_TRUSTED_PROMPT,
  CaptureUnderstandingAiOutputSchema,
} from "../../apps/api/src/experience-orchestration/capture-understanding.service.js";
import { assertExperiencePreparedOutputSemantics } from "../../apps/api/src/experience-orchestration/experience-orchestrator.service.js";

describe("Capture understanding AI boundary", () => {
  it("keeps Arabic and mixed technical input untrusted and asks one bounded question", () => {
    const output = CaptureUnderstandingAiOutputSchema.parse({
      likelyProjectName: "Atlas Delivery",
      likelyMeaning: "project_update",
      relatedWorkTitle: "Validate streaming fallback",
      relatedComponentLabel: "API authentication",
      clarification: {
        question: "ما قيمة API error rate وأين يمكن التحقق منها؟",
        missingField: "measured_result",
      },
      confidence: "high",
    });
    expect(output.clarification).not.toBeNull();
    expect(CAPTURE_UNDERSTANDING_TRUSTED_PROMPT).toContain("untrusted data");
    expect(CAPTURE_UNDERSTANDING_TRUSTED_PROMPT).toContain("at most one question");
  });

  it("quarantines ratings and activity-volume progress inference", () => {
    for (const question of [
      "Recommend a performance rating for the employee.",
      "Project progress is 90% because ten commits were made.",
      "اقترح تقييم الأداء للموظف.",
      "نسبة التقدم ٩٠٪ بناء على عدد المهام.",
    ]) {
      expect(() =>
        assertExperiencePreparedOutputSemantics({
          kind: "clarification_question",
          why: question,
          consequence: "No official record is created.",
          editableDraft: { title: "Private capture", body: "Review privately." },
        }),
      ).toThrow();
    }
  });
});
