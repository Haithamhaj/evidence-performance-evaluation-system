import { describe, expect, it } from "vitest";

import { structureTextUpdate, structureTranscript } from "./mock-ai";

describe("deterministic prototype structuring", () => {
  it("structures approved descriptive fields without performance outputs", () => {
    const draft = structureTextUpdate(
      "Completed the Arabic intent benchmark and reduced false positives by 18%. Next I will validate the Gulf fixtures.",
      { workItemId: "wi-104", criterionIds: ["criterion-quality"] },
    );

    expect(draft.activity).toContain("Arabic intent benchmark");
    expect(draft.result).toContain("18%");
    expect(draft.relatedWorkItemId).toBe("wi-104");
    expect(draft.relatedCriteria).toEqual(["criterion-quality"]);
    expect(JSON.stringify(draft)).not.toMatch(
      /rating|rank|productivityScore|readinessScore/iu,
    );
  });

  it("asks exactly one clarification question when the result is missing", () => {
    const draft = structureTextUpdate("Reviewed the new conversation samples.", {
      workItemId: "wi-109",
      criterionIds: [],
    });

    expect(draft.missingContext).toEqual(["result"]);
    expect(draft.clarificationQuestion).toBe(
      "What result or decision came from this activity?",
    );
  });

  it("preserves the simulated transcript as the original input", () => {
    const transcript =
      "واجهنا تأخيراً في بوابة العميل، ووثقنا البديل المؤقت. Next step is security review.";
    const draft = structureTranscript(transcript, {
      workItemId: "wi-112",
      criterionIds: ["criterion-resilience"],
    });

    expect(draft.originalInput).toBe(transcript);
    expect(draft.blocker).toContain("بوابة العميل");
    expect(draft.nextStep).toContain("security review");
  });
});
