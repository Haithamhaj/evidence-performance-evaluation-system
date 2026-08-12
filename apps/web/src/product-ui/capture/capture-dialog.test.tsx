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
    const dialog = screen.getByRole("dialog", { name: "Capture privately" });
    expect(dialog.contains(screen.getByRole("textbox", { name: "Capture note" }))).toBe(true);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it.each([
    [
      "English",
      EmployeeEnglish.args,
      {
        close: "Close",
        code: "Pasted code",
        file: "Private file or image",
        link: "HTTP or HTTPS link",
        note: "Capture note",
        options: ["Note", "Link", "Pasted code", "File", "Image"],
        privateHint:
          "Save a raw note, link, code, file, or image to your private Inbox. This does not create a Task, Update, Evidence record, Project progress, or evaluation input.",
        recovery:
          "Your private draft is still here. Try again or save manually when you are ready.",
        review: "Review and save privately",
        reviewHint:
          "Review this raw private draft before saving. Promotion to official work remains a separate action.",
        save: "Save privately",
        saved: "Saved to your private Inbox.",
        source: "Source type",
        title: "Capture privately",
        trigger: "Capture",
      },
    ],
    [
      "Arabic",
      EmployeeArabic.args,
      {
        close: "إغلاق",
        code: "شفرة ملصقة",
        file: "ملف أو صورة خاصة",
        link: "رابط HTTP أو HTTPS",
        note: "ملاحظة الإضافة",
        options: ["ملاحظة", "رابط", "شفرة ملصقة", "ملف", "صورة"],
        privateHint:
          "احفظ ملاحظة أو رابطًا أو شفرة أو ملفًا أو صورة خامًا في صندوقك الخاص. لا ينشئ ذلك مهمة أو تحديثًا أو سجل أدلة أو تقدم مشروع أو مدخلًا للتقييم.",
        recovery: "ما زالت مسودتك الخاصة هنا. حاول مرة أخرى أو احفظ يدويًا عندما تكون جاهزًا.",
        review: "مراجعة وحفظ خاص",
        reviewHint:
          "راجع هذه المسودة الخاصة الخام قبل الحفظ. تبقى الترقية إلى عمل رسمي إجراءً منفصلًا.",
        save: "حفظ خاص",
        saved: "تم الحفظ في صندوقك الخاص.",
        source: "نوع المصدر",
        title: "إضافة خاصة",
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
      expect(capture.getByText(labels.privateHint)).not.toBeNull();
      const source = capture.getByRole("combobox", { name: labels.source });
      for (const option of labels.options) {
        expect(capture.getByRole("option", { name: option })).not.toBeNull();
      }

      await user.selectOptions(source, "link");
      expect(capture.getByRole("textbox", { name: labels.link })).not.toBeNull();
      await user.selectOptions(source, "code");
      expect(capture.getByRole("textbox", { name: labels.code })).not.toBeNull();
      await user.selectOptions(source, "file");
      expect(capture.getByLabelText(labels.file)).not.toBeNull();
      await user.selectOptions(source, "text");
      await user.type(capture.getByRole("textbox", { name: labels.note }), "Private draft");
      await user.click(capture.getByRole("button", { name: labels.review }));
      expect(capture.getByText(labels.reviewHint)).not.toBeNull();

      await user.click(capture.getByRole("button", { name: labels.save }));
      await waitFor(() => expect(capture.getByRole("alert").textContent).toBe(labels.recovery));
      fetchMock.mockResolvedValue({ ok: true } as Response);
      await user.click(capture.getByRole("button", { name: labels.save }));
      await waitFor(() => expect(document.body.textContent).toContain(labels.saved));
    },
  );
});
