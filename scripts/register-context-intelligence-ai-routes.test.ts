import { describe, expect, it } from "vitest";

import { registerContextIntelligenceAiRoutes } from "./register-context-intelligence-ai-routes.js";

describe("Context Intelligence AI route registration", () => {
  it("plans the context and bounded experience artifacts without configuring a provider", async () => {
    const plan = await registerContextIntelligenceAiRoutes({ dryRun: true });

    expect(plan).toEqual({
      routes: [
        expect.objectContaining({
          routeKey: "context.summarize.v1",
          promptVersion: "context-summary-prompt.v1",
          outputSchemaVersion: "context-analysis-output.v1",
          outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
        expect.objectContaining({
          routeKey: "context.project-match.v1",
          promptVersion: "context-project-match-prompt.v1",
          outputSchemaVersion: "project-link-suggestion-output.v1",
          outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
        expect.objectContaining({
          routeKey: "task.draft.v1",
          promptVersion: "task-draft-prompt.v1",
          outputSchemaVersion: "task-draft-output.v1",
          outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
        expect.objectContaining({
          routeKey: "experience.prepare-next.v1",
          promptVersion: "experience-prepare-prompt.v1",
          outputSchemaVersion: "experience-prepared-output.v1",
          outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
        expect.objectContaining({
          routeKey: "experience.capture-understand.v1",
          promptVersion: "capture-understanding-prompt.v1",
          outputSchemaVersion: "capture-understanding-ai-output.v1",
          outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
        expect.objectContaining({
          routeKey: "experience.task-assistant.v1",
          promptVersion: "task-assistant-prompt.v3",
          outputSchemaVersion: "task-assistant-output.v1",
          outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
        expect.objectContaining({
          routeKey: "experience.project-assistant.v1",
          promptVersion: "project-assistant-prompt.v1",
          outputSchemaVersion: "project-assistant-output.v1",
          outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
      ],
    });
    expect(JSON.stringify(plan)).not.toMatch(/provider|endpoint|credential|token/iu);
  });

  it("requires authorized production registration context outside dry-run", async () => {
    await expect(registerContextIntelligenceAiRoutes({ dryRun: false })).rejects.toMatchObject({
      code: "AI_ROUTE_REGISTRATION_CONTEXT_REQUIRED",
    });
  });

  it("plans only one requested governed route for a bounded registration", async () => {
    await expect(
      registerContextIntelligenceAiRoutes({
        dryRun: true,
        routeKey: "experience.task-assistant.v1",
      }),
    ).resolves.toMatchObject({
      routes: [
        {
          routeKey: "experience.task-assistant.v1",
          promptVersion: "task-assistant-prompt.v3",
          outputSchemaVersion: "task-assistant-output.v1",
        },
      ],
    });
  });
});
