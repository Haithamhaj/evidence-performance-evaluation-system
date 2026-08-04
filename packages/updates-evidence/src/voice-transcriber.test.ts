import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import { AiRouterVoiceTranscriber, VoiceTranscriptionAiOutputSchema } from "./voice-transcriber.js";

describe("governed voice transcriber", () => {
  it("routes a strict dialect-aware transcript only through update.transcribe", async () => {
    const run = vi.fn(async (_request) => ({
      runId: crypto.randomUUID(),
      output: { transcript: "تم نشر الإصلاح على staging.", language: "ar", dialect: "gulf" },
    }));
    const artifactId = crypto.randomUUID();
    const trustedBody = "Approved transcription prompt.";
    const sha256 = createHash("sha256").update(trustedBody).digest("hex");
    const transcriber = new AiRouterVoiceTranscriber(
      { run } as never,
      {
        analysisPromptArtifact: {
          findUnique: vi.fn(async () => ({
            id: artifactId,
            routeKey: "update.transcribe",
            version: "update-transcribe.v1",
            bodyHash: sha256,
            trustedBody,
          })),
        },
      } as never,
      { systemId: crypto.randomUUID(), timeoutMs: 30_000 },
    );

    await expect(
      transcriber.transcribe({
        voiceSessionId: crypto.randomUUID(),
        uploadedSourceId: crypto.randomUUID(),
        projectScopeId: crypto.randomUUID(),
        departmentScopeId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        mediaType: "audio/mpeg",
        byteSize: 128,
        declaredDurationSeconds: 4,
      }),
    ).resolves.toMatchObject({ language: "ar", dialect: "gulf" });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: "update.transcribe",
        inputReference: expect.stringMatching(/^voice-session:/u),
        requiresHumanApproval: true,
        input: expect.objectContaining({
          trustedInstruction: {
            routeKey: "update.transcribe",
            artifactId,
            version: "update-transcribe.v1",
            sha256,
          },
        }),
      }),
      expect.any(Function),
    );
  });

  it.each([
    { transcript: "فصحى", language: "ar", dialect: "fusha" },
    { transcript: "وش صار؟", language: "ar", dialect: "gulf" },
    { transcript: "شو صار؟", language: "ar", dialect: "levantine" },
    { transcript: "The deploy passed.", language: "en", dialect: "english" },
    { transcript: "تم deploy على staging", language: "mixed", dialect: "mixed" },
  ])("accepts approved $dialect fixture metadata", (output) => {
    expect(VoiceTranscriptionAiOutputSchema.parse(output)).toEqual(output);
  });
});
