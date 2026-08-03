import { describe, expect, it, vi } from "vitest";

import { VoiceUpdatesController } from "./voice.controller.js";

describe("VoiceUpdatesController", () => {
  it("passes only the authenticated employee and validated transcript commands to the governed service", async () => {
    const voice = {
      start: vi.fn(async () => ({ sessionId: crypto.randomUUID() })),
      reviseTranscript: vi.fn(async () => ({})),
      confirmTranscript: vi.fn(async () => ({})),
    };
    const controller = new VoiceUpdatesController(voice as never);
    const employeeId = crypto.randomUUID();
    const input = {
      idempotencyKey: crypto.randomUUID(),
      uploadedSourceId: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      workstreamId: null,
      workItemId: null,
      declaredDurationSeconds: 9,
    };

    await controller.start(
      { principal: { userId: employeeId, active: true }, correlationId: crypto.randomUUID() } as never,
      input,
    );

    expect(voice.start).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { userId: employeeId, active: true }, input }),
    );
  });
});
