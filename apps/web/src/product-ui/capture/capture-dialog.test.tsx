// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptureDialog } from "./capture-dialog.js";
import stableShellStory, {
  EmployeeArabic,
  EmployeeEnglish,
} from "../shell/stable-shell.stories.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CaptureDialog", () => {
  it("keeps a voice transcript editable and employee-confirmed before using it in the Update", async () => {
    vi.stubGlobal("Audio", undefined);
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    const sessionId = "88888888-8888-4888-8888-888888888888";
    const voiceFetcher = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/evidence/uploads")) {
        return new Response(JSON.stringify({ id: "77777777-7777-4777-8777-777777777777" }), {
          status: 200,
        });
      }
      if (path.endsWith(`/voice-updates/${sessionId}/confirm`)) {
        return new Response(
          JSON.stringify({
            sessionId,
            state: "transcript_confirmed",
            transcript: "Verified the voice Update flow.",
            revision: 1,
            transcriptConfirmed: true,
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          sessionId,
          state: "transcript_ready",
          transcript: "Verified the voice Update flow.",
          revision: 1,
          transcriptConfirmed: false,
        }),
        { status: 200 },
      );
    });
    const draft = structuredDraft({
      result: "The employee confirmed the voice transcript.",
      summary: "Voice Update flow verified",
    });
    const prepareUpdate = vi.fn().mockResolvedValue({
      state: "ready_for_review",
      sessionId: draft.sessionId,
      sessionVersion: 1,
      draft: {
        ...draft,
        evidenceClaimDrafts: ["The confirmed voice transcript verifies the result."],
      },
    });
    const prepareEvidence = vi.fn().mockResolvedValue({
      id: "99999999-9999-4999-8999-999999999999",
      revision: 1,
      supportedClaim: "The confirmed voice transcript verifies the result.",
      contributionContext: "Employee-confirmed voice transcript.",
    });
    render(
      createElement(CaptureDialog, {
        catalog,
        loadContext: vi.fn().mockResolvedValue({
          projects: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Evidence Performance System — Phase 2",
              workItems: [],
              workstreams: [],
            },
          ],
        }),
        locale: "en",
        onSaved: vi.fn(),
        prepareEvidence,
        prepareUpdate,
        save: vi.fn(),
        understand: vi.fn().mockResolvedValue(codexUnderstanding()),
        voiceFetcher,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Capture" }));
    const capture = within(screen.getByRole("dialog", { name: "Share anything" }));
    await user.click(capture.getByRole("button", { name: "Add a voice note" }));
    const voice = within(await capture.findByRole("region", { name: "Voice update" }));
    const upload = voice.getByLabelText("Upload audio") as HTMLInputElement;
    await user.upload(upload, new File(["audio"], "update.mp3", { type: "audio/mpeg" }));
    await user.click(await voice.findByRole("button", { name: "Confirm transcript" }));
    expect(await voice.findByText("Transcript ready for your review")).not.toBeNull();

    await user.click(capture.getByRole("button", { name: "Understand this" }));
    await user.click(await capture.findByRole("button", { name: "Continue review" }));
    expect(prepareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "11111111-1111-4111-8111-111111111111",
        rawText: "",
        sources: [{ kind: "voice_transcript", voiceSessionId: sessionId }],
      }),
    );
    expect(prepareEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          kind: "pasted_text",
          text: "Verified the voice Update flow.",
        },
      }),
    );
  });

  it("asks for one Project when voice starts and more than one authorized Project is available", async () => {
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    render(
      createElement(CaptureDialog, {
        catalog,
        loadContext: vi.fn().mockResolvedValue({
          projects: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Atlas Delivery",
              workItems: [],
              workstreams: [],
            },
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Evaluation System",
              workItems: [],
              workstreams: [],
            },
          ],
        }),
        locale: "en",
        onSaved: vi.fn(),
        save: vi.fn(),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Capture" }));
    const capture = within(screen.getByRole("dialog", { name: "Share anything" }));
    await user.click(capture.getByRole("button", { name: "Add a voice note" }));

    const project = await capture.findByRole("combobox", { name: "Project for this update" });
    expect(capture.queryByRole("region", { name: "Voice update" })).toBeNull();
    await user.selectOptions(project, "22222222-2222-4222-8222-222222222222");
    expect(await capture.findByRole("region", { name: "Voice update" })).not.toBeNull();
  });

  it("stages an attached image in the understood Project and sends it with the Update", async () => {
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    const stageUpdateFile = vi.fn().mockResolvedValue({
      kind: "image",
      uploadedSourceId: "77777777-7777-4777-8777-777777777777",
    });
    const draft = structuredDraft({
      result: "The screenshot records the verified result.",
      summary: "Screenshot attached to the Project Update",
    });
    const prepareUpdate = vi.fn().mockResolvedValue({
      state: "ready_for_review",
      sessionId: draft.sessionId,
      sessionVersion: 1,
      draft,
    });
    render(
      createElement(CaptureDialog, {
        catalog,
        locale: "en",
        onSaved: vi.fn(),
        prepareUpdate,
        save: vi.fn(),
        stageUpdateFile,
        understand: vi.fn().mockResolvedValue(codexUnderstanding()),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Capture" }));
    const capture = within(screen.getByRole("dialog", { name: "Share anything" }));
    await user.type(
      capture.getByRole("textbox", { name: "What are you working on?" }),
      "https://example.invalid/result\nThe attached screenshot records the verified result.\n```ts\nexpect(ready).toBe(true);\n```",
    );
    const imageInput = screen
      .getByRole("dialog", { name: "Share anything" })
      .querySelector<HTMLInputElement>('input[accept="image/png,image/jpeg,image/webp"]')!;
    const image = new File(["image"], "verified-result.png", { type: "image/png" });
    await user.upload(imageInput, image);
    await user.click(capture.getByRole("button", { name: "Understand this" }));
    await user.click(await capture.findByRole("button", { name: "Continue review" }));

    expect(stageUpdateFile).toHaveBeenCalledWith(image, {
      projectId: "11111111-1111-4111-8111-111111111111",
      workstreamId: null,
    });
    expect(prepareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: [
          { kind: "url", url: "https://example.invalid/result" },
          { kind: "pasted_code", text: "expect(ready).toBe(true);" },
          {
            kind: "image",
            uploadedSourceId: "77777777-7777-4777-8777-777777777777",
          },
        ],
      }),
    );
    const review = within(await screen.findByRole("dialog", { name: "Review before confirming" }));
    expect(review.getByText("Manual capture · verified-result.png")).not.toBeNull();
    expect(review.queryByText(/update-source:/u)).toBeNull();
  });

  it("opens Review with a real prepared Update session instead of prototype identifiers", async () => {
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    const prepareUpdate = vi.fn().mockResolvedValue({
      state: "ready_for_review",
      sessionId: "33333333-3333-4333-8333-333333333333",
      sessionVersion: 1,
      draft: {
        id: "44444444-4444-4444-8444-444444444444",
        sessionId: "33333333-3333-4333-8333-333333333333",
        revision: 1,
        summary: "Live assistant route verified",
        result: "Codex received and accepted a governed suggestion.",
        blocker: null,
        nextAction: "Record the accepted Update.",
        contributionContext: "Codex performed the employee journey.",
        executionMode: "ai_assisted",
        sourceReferences: ["update-source:55555555-5555-4555-8555-555555555555"],
        evidenceIds: [],
        documentationNeeds: [],
        relatedProgressComponentIds: [],
        comparison: {
          previousAcceptedEventId: null,
          changedFields: ["result"],
          explanation: "First accepted state.",
        },
      },
    });
    const understand = vi.fn().mockResolvedValue({
      schemaVersion: "capture-understanding.v1",
      likelyProject: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Evidence Performance System — Phase 2",
        confidence: "high",
      },
      likelyMeaning: "project_update",
      relatedWorkItemId: "22222222-2222-4222-8222-222222222222",
      relatedWorkItemTitle: "Complete Codex employee journey acceptance",
      relatedComponentId: null,
      sourceRefs: [],
      clarification: null,
      confidence: "high",
      createsOfficialRecord: false,
    });
    render(
      createElement(CaptureDialog, {
        catalog,
        locale: "en",
        onSaved: vi.fn(),
        prepareUpdate,
        save: vi.fn(),
        understand,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Capture" }));
    const capture = within(screen.getByRole("dialog", { name: "Share anything" }));
    await user.type(
      capture.getByRole("textbox", { name: "What are you working on?" }),
      "Project: Evidence Performance System — Phase 2. Live assistant route verified.",
    );
    await user.click(capture.getByRole("button", { name: "Understand this" }));
    await user.click(await capture.findByRole("button", { name: "Continue review" }));

    expect(prepareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.any(String),
        projectId: "11111111-1111-4111-8111-111111111111",
        workItemId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    const review = within(await screen.findByRole("dialog", { name: "Review before confirming" }));
    expect((review.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe(
      "Live assistant route verified",
    );
    expect(review.getByText(/Complete Codex employee journey acceptance/u)).not.toBeNull();
    expect(review.queryByRole("heading", { name: "Suggested Evidence draft" })).toBeNull();
  });

  it("prepares a source-backed Evidence draft for employee edit and selection", async () => {
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    const draft = structuredDraft({
      result: "The live Capture journey is verified.",
      summary: "Live Capture journey verified",
    });
    const prepareEvidence = vi.fn().mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      revision: 1,
      supportedClaim: "The live Capture journey is verified by commit 65e4fcf.",
      contributionContext: "AI-prepared contribution context for employee review.",
    });
    render(
      createElement(CaptureDialog, {
        catalog,
        locale: "en",
        onSaved: vi.fn(),
        prepareEvidence,
        prepareUpdate: vi.fn().mockResolvedValue({
          state: "ready_for_review",
          sessionId: draft.sessionId,
          sessionVersion: 1,
          draft: {
            ...draft,
            evidenceClaimDrafts: ["The live Capture journey is verified by commit 65e4fcf."],
          },
        }),
        save: vi.fn(),
        understand: vi.fn().mockResolvedValue(codexUnderstanding()),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Capture" }));
    const capture = within(screen.getByRole("dialog", { name: "Share anything" }));
    await user.type(
      capture.getByRole("textbox", { name: "What are you working on?" }),
      "https://github.com/Haithamhaj/evidence-performance-evaluation-system/commit/65e4fcf. Focused tests passed.",
    );
    await user.click(capture.getByRole("button", { name: "Understand this" }));
    await user.click(await capture.findByRole("button", { name: "Continue review" }));

    expect(prepareEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "11111111-1111-4111-8111-111111111111",
        source: {
          kind: "url",
          url: "https://github.com/Haithamhaj/evidence-performance-evaluation-system/commit/65e4fcf",
        },
        supportedClaim: "The live Capture journey is verified by commit 65e4fcf.",
        workItemId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    const review = within(await screen.findByRole("dialog", { name: "Review before confirming" }));
    expect(review.getByRole("heading", { name: "Suggested Evidence draft" })).not.toBeNull();
    expect(
      (review.getByLabelText("Confirm evidence contribution") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("answers one real Update clarification before opening Review", async () => {
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    const questionDraft = structuredDraft({
      result: "The verified result is still missing.",
      summary: "Live route verification",
    });
    const readyDraft = structuredDraft({
      result: "The governed route returned a validated response.",
      summary: "Live route verified",
    });
    const prepareUpdate = vi.fn().mockResolvedValue({
      state: "draft_with_question",
      sessionId: questionDraft.sessionId,
      sessionVersion: 2,
      draft: questionDraft,
      turnId: "66666666-6666-4666-8666-666666666666",
      turnNumber: 1,
      question: "What result did you verify?",
      affects: ["result"],
      remainingFieldCount: 1,
    });
    const answerUpdate = vi.fn().mockResolvedValue({
      state: "ready_for_review",
      sessionId: readyDraft.sessionId,
      sessionVersion: 3,
      draft: readyDraft,
    });
    render(
      createElement(CaptureDialog, {
        answerUpdate,
        catalog,
        locale: "en",
        onSaved: vi.fn(),
        prepareUpdate,
        save: vi.fn(),
        understand: vi.fn().mockResolvedValue(codexUnderstanding()),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Capture" }));
    const capture = within(screen.getByRole("dialog", { name: "Share anything" }));
    await user.type(capture.getByRole("textbox", { name: "What are you working on?" }), "Update");
    await user.click(capture.getByRole("button", { name: "Understand this" }));
    await user.click(await capture.findByRole("button", { name: "Continue review" }));
    expect(await capture.findByText("What result did you verify?")).not.toBeNull();
    await user.type(capture.getByPlaceholderText("Your answer…"), "A validated model response.");
    await user.click(capture.getByRole("button", { name: "Continue review" }));

    expect(answerUpdate).toHaveBeenCalledWith({
      answer: "A validated model response.",
      sessionId: questionDraft.sessionId,
      sessionVersion: 2,
      turnId: "66666666-6666-4666-8666-666666666666",
    });
    expect(await screen.findByRole("dialog", { name: "Review before confirming" })).not.toBeNull();
  });

  it("turns one mixed private capture into an understood draft and one clarification", async () => {
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    const understand = vi.fn().mockResolvedValue({
      schemaVersion: "capture-understanding.v1",
      likelyProject: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Atlas Delivery",
        confidence: "high",
      },
      likelyMeaning: "suggested_evidence",
      relatedWorkItemId: "22222222-2222-4222-8222-222222222222",
      relatedWorkItemTitle: "Validate streaming fallback",
      relatedComponentId: null,
      sourceRefs: [],
      clarification: {
        question: "What measured API error rate did you observe, and where can it be verified?",
        missingField: "kpi_measurement",
      },
      confidence: "high",
      createsOfficialRecord: false,
    });
    render(
      createElement(CaptureDialog, {
        catalog,
        locale: "en",
        onSaved: vi.fn(),
        save: vi.fn(),
        understand,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Capture" }));
    const dialog = within(screen.getByRole("dialog", { name: "Share anything" }));
    await user.type(
      dialog.getByRole("textbox", { name: "What are you working on?" }),
      "https://github.com/atlas/voice/pull/184 API fallback works in staging.",
    );
    await user.click(dialog.getByRole("button", { name: "Understand this" }));

    await waitFor(() => expect(understand).toHaveBeenCalledTimes(1));
    expect(dialog.getByText("Atlas Delivery")).not.toBeNull();
    expect(dialog.getByText("High confidence")).not.toBeNull();
    expect(dialog.getByText("Suggested evidence")).not.toBeNull();
    expect(
      dialog.getByText(
        "What measured API error rate did you observe, and where can it be verified?",
      ),
    ).not.toBeNull();
    expect(
      dialog.getByText("Nothing will be posted or recorded until you confirm."),
    ).not.toBeNull();
  });

  it("labels the private review flow without creating official work", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(CaptureDialog, { catalog, locale: "en", onSaved: vi.fn(), save: vi.fn() }),
    );
    expect(markup).toContain("Capture");
    expect(markup).not.toContain("official Task");
  });

  it("does not render a Capture trigger for a manager-only shell", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(CaptureDialog, {
        catalog,
        disabled: true,
        locale: "en",
        onSaved: vi.fn(),
        save: vi.fn(),
      }),
    );
    expect(markup).toBe("");
  });

  it("opens the capture form and returns focus after Escape", async () => {
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    render(
      createElement(CaptureDialog, {
        catalog,
        locale: "en",
        onSaved: vi.fn(),
        save: vi.fn(),
      }),
    );
    const trigger = screen.getByRole("button", { name: "Capture" });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Share anything" });
    expect(dialog.contains(screen.getByRole("textbox", { name: "What are you working on?" }))).toBe(
      true,
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it.each([
    [
      "English",
      EmployeeEnglish.args,
      {
        close: "Close",
        composer: "What are you working on?",
        privateNotice: "Nothing will be posted or recorded until you confirm.",
        recovery:
          "Your private draft is still here. Try again or save manually when you are ready.",
        save: "Save privately",
        saved: "Saved to your private Inbox.",
        title: "Share anything",
        trigger: "Capture",
      },
    ],
    [
      "Arabic",
      EmployeeArabic.args,
      {
        close: "إغلاق",
        composer: "على ماذا تعمل؟",
        privateNotice: "لن يتم نشر أو تسجيل أي شيء حتى تؤكد.",
        recovery: "ما زالت مسودتك الخاصة هنا. حاول مرة أخرى أو احفظ يدويًا عندما تكون جاهزًا.",
        save: "حفظ خاص",
        saved: "تم الحفظ في صندوقك الخاص.",
        title: "شارك أي شيء",
        trigger: "إضافة",
      },
    ],
  ] as const)(
    "keeps every %s employee story capture state localized and labelled",
    async (_, args, labels) => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false } as Response);
      const user = userEvent.setup();
      render(
        createElement(
          stableShellStory.component,
          args as Readonly<{ locale: "ar" | "en"; role: "employee" | "manager" }>,
        ),
      );

      await user.click(screen.getByRole("button", { name: labels.trigger }));
      const capture = within(screen.getByRole("dialog", { name: labels.title }));
      expect(capture.getByRole("button", { name: labels.close })).not.toBeNull();
      expect(capture.getByText(labels.privateNotice)).not.toBeNull();
      await user.type(capture.getByRole("textbox", { name: labels.composer }), "Private draft");

      await user.click(capture.getByRole("button", { name: labels.save }));
      await waitFor(() => expect(capture.getByRole("alert").textContent).toBe(labels.recovery));
      fetchMock.mockResolvedValue({ ok: true } as Response);
      await user.click(capture.getByRole("button", { name: labels.save }));
      await waitFor(() => expect(document.body.textContent).toContain(labels.saved));
    },
  );
});

function structuredDraft(input: { summary: string; result: string }) {
  return {
    id: crypto.randomUUID(),
    sessionId: "33333333-3333-4333-8333-333333333333",
    revision: 1,
    summary: input.summary,
    result: input.result,
    blocker: null,
    nextAction: "Record the accepted Update.",
    contributionContext: "Codex performed the employee journey.",
    executionMode: "ai_assisted" as const,
    sourceReferences: ["update-source:55555555-5555-4555-8555-555555555555"],
    evidenceClaimDrafts: [],
    evidenceIds: [],
    documentationNeeds: [],
    relatedProgressComponentIds: [],
    comparison: {
      previousAcceptedEventId: null,
      changedFields: ["result"],
      explanation: "First accepted state.",
    },
  };
}

function codexUnderstanding() {
  return {
    schemaVersion: "capture-understanding.v1" as const,
    likelyProject: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Evidence Performance System — Phase 2",
      confidence: "high" as const,
    },
    likelyMeaning: "project_update" as const,
    relatedWorkItemId: "22222222-2222-4222-8222-222222222222",
    relatedWorkItemTitle: "Complete Codex employee journey acceptance",
    relatedComponentId: null,
    sourceRefs: [],
    clarification: null,
    confidence: "high" as const,
    createsOfficialRecord: false as const,
  };
}
