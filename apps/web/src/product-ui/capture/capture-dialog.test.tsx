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
});

describe("CaptureDialog", () => {
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
