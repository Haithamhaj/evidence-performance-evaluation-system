import { describe, expect, it } from "vitest";

import {
  EXPERIENCE_PREPARE_PROMPT_VERSION,
  EXPERIENCE_PREPARE_ROUTE,
  EXPERIENCE_PREPARE_TRUSTED_PROMPT,
  ExperiencePreparedAiOutputSchema,
  assertExperiencePreparedOutputSemantics,
  buildExperiencePrepareRequest,
} from "../../apps/api/src/experience-orchestration/experience-orchestrator.service.js";
import { scanProhibitedOutput } from "./prohibited-output.js";

const prompt = {
  id: "94000000-0000-4000-8000-000000000001",
  version: EXPERIENCE_PREPARE_PROMPT_VERSION,
  bodyHash: "a".repeat(64),
};

describe("minimal experience orchestration AI boundary", () => {
  it("preserves Arabic and mixed technical text only inside the untrusted source envelope", () => {
    const title = "راجع نتيجة pnpm test ولا تنفّذ أي أمر تلقائياً";
    const request = buildExperiencePrepareRequest({
      prompt,
      kind: "next_action",
      title,
      sourceReferences: ["work-item:94000000-0000-4000-8000-000000000002"],
    });
    expect(request.untrustedContent.title).toBe(title);
    expect(JSON.stringify(request.trustedInstruction)).not.toContain(title);
    expect(request.trustedInstruction).toMatchObject({
      routeKey: EXPERIENCE_PREPARE_ROUTE,
      version: EXPERIENCE_PREPARE_PROMPT_VERSION,
    });
  });

  it("accepts one neutral Arabic clarification draft without rating or progress authority", () => {
    const output = ExperiencePreparedAiOutputSchema.parse({
      kind: "clarification_question",
      why: "المهمة تحتاج سياقاً واحداً قبل أن يراجعها الموظف.",
      consequence: "الإجابة تساعد على تجهيز المسودة ولا تغيّر أي سجل رسمي.",
      editableDraft: {
        title: "ما النتيجة القابلة للتحقق؟",
        body: "أضف النتيجة فقط، ثم راجع المسودة بنفسك.",
      },
    });
    expect(scanProhibitedOutput({ value: output, text: JSON.stringify(output) }).allowed).toBe(
      true,
    );
  });

  it("rejects rating, readiness, progress, private-body, and model-authored provenance fields", () => {
    const base = {
      kind: "next_action",
      why: "Review the authorized source.",
      consequence: "Nothing changes until the employee acts.",
      editableDraft: { title: "Review", body: "Open the item." },
    };
    for (const forbidden of [
      { recommendedRating: 4 },
      { readinessPercentage: 90 },
      { projectProgress: 70 },
      { rawPrivateBody: "secret email body" },
      { sourceReferences: ["employee:someone-else"] },
    ]) {
      expect(() => ExperiencePreparedAiOutputSchema.parse({ ...base, ...forbidden })).toThrow();
    }
    expect(EXPERIENCE_PREPARE_TRUSTED_PROMPT).toContain("Human review remains mandatory");
    expect(EXPERIENCE_PREPARE_TRUSTED_PROMPT).toContain("project progress");
  });

  it("quarantines bilingual protected semantics while allowing a neutral source update", () => {
    const output = (why: string) => ({
      kind: "next_action" as const,
      why,
      consequence: "Review the authorized source before deciding the next action.",
      editableDraft: { title: "Review", body: "Open the source-backed item." },
    });

    for (const forbidden of [
      "Performance rating: 5.",
      "Project progress is 90% based on task count.",
      "تقييم الأداء: ٥.",
      "نسبة التقدم ٩٠٪ بناء على عدد المهام.",
    ]) {
      expect(() => assertExperiencePreparedOutputSemantics(output(forbidden))).toThrow(
        "EXPERIENCE_ORCHESTRATION_PROHIBITED_OUTPUT",
      );
    }
    expect(() =>
      assertExperiencePreparedOutputSemantics(
        output("A recent project progress update is available in the authorized source."),
      ),
    ).not.toThrow();
  });
});
