import { describe, expect, it } from "vitest";

import {
  VOICE_TRANSCRIBE_PROMPT_VERSION,
  VoiceTranscriptionAiOutputSchema,
} from "../../packages/updates-evidence/src/voice-transcriber.js";

describe("voice transcription AI contract", () => {
  it.each([
    { transcript: "أُنجزت المراجعة وتم نشر الإصلاح.", language: "ar", dialect: "fusha" },
    { transcript: "خلصت المراجعة ونشرت الإصلاح.", language: "ar", dialect: "gulf" },
    { transcript: "خلصت المراجعة ونشرت الإصلاح.", language: "ar", dialect: "levantine" },
    { transcript: "The review is complete and the fix is deployed.", language: "en", dialect: "english" },
    { transcript: "خلصت review والـ deploy passed.", language: "mixed", dialect: "mixed" },
  ])("accepts strict $dialect transcript metadata", (fixture) => {
    expect(VoiceTranscriptionAiOutputSchema.parse(fixture)).toEqual(fixture);
  });

  it("keeps the transcription route versioned and rejects rating-shaped output", () => {
    expect(VOICE_TRANSCRIBE_PROMPT_VERSION).toBe("update-transcribe.v1");
    expect(() =>
      VoiceTranscriptionAiOutputSchema.parse({
        transcript: "تم النشر.",
        language: "ar",
        dialect: "fusha",
        suggestedRating: 5,
      }),
    ).toThrow();
  });
});
