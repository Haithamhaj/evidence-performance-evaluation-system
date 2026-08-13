import { describe, expect, it } from "vitest";

import {
  TASK_ASSISTANT_TRUSTED_PROMPT,
  TaskAssistantAiOutputSchema,
} from "../../apps/api/src/experience-orchestration/task-assistant.service.js";
import { assertExperiencePreparedOutputSemantics } from "../../apps/api/src/experience-orchestration/experience-orchestrator.service.js";

describe("Task assistant AI boundary", () => {
  it("represents a bounded Arabic answer with one employee-confirmed action", () => {
    const output = TaskAssistantAiOutputSchema.parse({
      answer: "الخطوة التالية هي تشغيل الفحص المركز ومراجعة النتيجة.",
      suggestedAction: {
        kind: "status_change",
        status: "in_review",
        rationale: "يُجهز الانتقال للمراجعة فقط بعد نجاح الفحص.",
      },
    });
    expect(output.suggestedAction?.status).toBe("in_review");
    expect(TASK_ASSISTANT_TRUSTED_PROMPT).toContain("Human confirmation remains mandatory");
    expect(TASK_ASSISTANT_TRUSTED_PROMPT).toContain("suggested GitHub Evidence");
  });

  it("quarantines rating and activity-volume progress language", () => {
    for (const answer of [
      "Recommend a performance rating of 5 for Codex.",
      "Project progress is 95% because ten commits were made.",
      "اقترح تقييم أداء ٥ للموظف.",
      "نسبة تقدم المشروع ٩٥٪ بسبب عدد المهام.",
    ]) {
      expect(() =>
        assertExperiencePreparedOutputSemantics({
          kind: "next_action",
          why: answer,
          consequence: "No command is created.",
          editableDraft: { title: "Task assistance", body: answer },
        }),
      ).toThrow();
    }
  });
});
