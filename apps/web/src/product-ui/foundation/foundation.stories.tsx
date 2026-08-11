"use client";

import { ActionButton, FocusedDialog, ProductDisclosure, ProductIcon } from "@evaluation/ui";
import { createElement, useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import styles from "./foundation.module.css";

type FoundationState = "empty" | "error" | "loading" | "ready";

type FoundationProperties = Readonly<{
  locale?: "ar" | "en";
  state?: FoundationState;
}>;

const copy = {
  ar: {
    changed: "ما الذي تغيّر",
    close: "إغلاق",
    confirm: "تأكيد",
    continue: "المتابعة",
    correct: "تصحيح",
    date: "اليوم / 11 أغسطس 2026",
    decision: "يحتاج قرارك",
    dismiss: "تجاهل",
    due: "اليوم",
    empty: "لا توجد إجراءات مطلوبة الآن",
    emptyBody: "جهّز المساعد يومك، وسيظهر أي قرار جديد هنا.",
    error: "تعذر تحديث الموجز",
    errorBody: "بقيت بياناتك السابقة محفوظة. أعد المحاولة لاسترجاع آخر حالة.",
    greeting: "صباح الخير، Codex",
    prepared: "مجهز لك",
    retry: "إعادة المحاولة",
    review: "مراجعة المسودة",
    today: "اليوم",
  },
  en: {
    changed: "What Changed",
    close: "Close",
    confirm: "Confirm",
    continue: "Continue",
    correct: "Correct",
    date: "Today / 11 Aug 2026",
    decision: "Needs Your Decision",
    dismiss: "Dismiss",
    due: "Today",
    empty: "Nothing needs your action",
    emptyBody: "Your assistant prepared the day. New decisions will appear here.",
    error: "The brief could not refresh",
    errorBody: "Your previous context is safe. Retry to recover the latest state.",
    greeting: "Good morning, Codex",
    prepared: "Prepared for You",
    retry: "Try again",
    review: "Review draft",
    today: "Today",
  },
} as const;

export function Foundation({ locale = "en", state = "ready" }: FoundationProperties) {
  const [currentState, setCurrentState] = useState(state);
  const text = copy[locale];
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className={styles.canvas!} dir={direction} lang={locale}>
      <main className={styles.brief!}>
        <header>
          <p className={styles.eyebrow!}>{text.date}</p>
          <h1 className={styles.heading!}>{text.greeting}</h1>
        </header>

        {currentState === "loading" ? (
          <section
            aria-busy="true"
            aria-label={locale === "ar" ? "جاري التحميل" : "Loading"}
            className={styles.stateCard!}
          >
            <div className={styles.loadingLine!} />
            <div className={styles.loadingLine!} />
          </section>
        ) : null}

        {currentState === "empty" ? (
          <section className={styles.stateCard!}>
            {createElement(ProductIcon, { name: "check" })}
            <h2>{text.empty}</h2>
            <p className={styles.supporting!}>{text.emptyBody}</p>
          </section>
        ) : null}

        {currentState === "error" ? (
          <section className={styles.stateCard!} role="alert">
            {createElement(ProductIcon, { name: "help" })}
            <h2>{text.error}</h2>
            <p className={styles.supporting!}>{text.errorBody}</p>
            {createElement(ActionButton, {
              children: text.retry,
              onPress: () => setCurrentState("ready"),
              variant: "primary",
            })}
          </section>
        ) : null}

        {currentState === "ready" ? (
          <>
            <section className={`${styles.section!} ${styles.decision!}`}>
              <p className={styles.sectionLabel!}>{text.decision}</p>
              <div className={`${styles.card!} ${styles.decisionCard!}`}>
                <span aria-hidden="true" className={styles.decisionSourceIcon!}>
                  {createElement(ProductIcon, { name: "github", size: "large" })}
                </span>
                <div className={styles.decisionCopy!}>
                  <h2>
                    {locale === "ar"
                      ? "ربط PR #184 بمصادقة API؟"
                      : "Link PR #184 to API authentication?"}
                  </h2>
                  <p className={styles.meta!}>GitHub · Atlas Voice Intelligence · 8 min ago</p>
                  <p className={styles.reason!}>
                    <strong>{locale === "ar" ? "السبب: " : "Why: "}</strong>
                    {locale === "ar"
                      ? "يعدّل تدفق المصادقة المستخدم في "
                      : "It modifies the authentication flow used by "}
                    <bdi>/v1/voice/sessions</bdi>.
                  </p>
                  <p className={styles.meta!}>
                    {locale === "ar"
                      ? "الحالة: تم التحقق من المصدر قبل 8 دقائق."
                      : "Freshness: verified against the source 8 min ago."}
                  </p>
                </div>
                <div className={styles.actions!}>
                  {createElement(ActionButton, { children: text.confirm, variant: "primary" })}
                  {createElement(ActionButton, { children: text.correct })}
                  {createElement(ActionButton, { children: text.dismiss })}
                </div>
              </div>
            </section>

            <section className={styles.section!}>
              <p className={styles.sectionLabel!}>{text.prepared}</p>
              <div className={`${styles.card!} ${styles.prepared!}`}>
                <div className={`${styles.preparedBody!} ${styles.preparedBodyDirect!}`}>
                  <div className={styles.preparedLead!}>
                    <span aria-hidden="true" className={styles.preparedSourceIcon!}>
                      {createElement(ProductIcon, { name: "document", size: "large" })}
                    </span>
                    <div className={styles.preparedCopy!}>
                      <strong>
                        {locale === "ar"
                          ? "مسودة تحديث المشروع الأسبوعي"
                          : "Weekly project update draft"}
                      </strong>
                      <span className={styles.supporting!}>
                        {locale === "ar"
                          ? "أُعدت من 3 مهام مؤكدة وPR #184."
                          : "Prepared from 3 confirmed tasks and PR #184."}
                      </span>
                    </div>
                  </div>
                  {createElement(FocusedDialog, {
                    closeLabel: text.close,
                    title: locale === "ar" ? "مراجعة تحديث المشروع" : "Review project update",
                    trigger: createElement(ActionButton, { children: text.review }),
                    children: (
                      <div className={styles.dialogCopy!}>
                        <p>
                          {locale === "ar"
                            ? "تحققت المصادقة وأصبحت واجهة الصوت جاهزة للاختبار المتكامل."
                            : "Authentication is verified and the voice API is ready for integrated testing."}
                        </p>
                        {createElement(ActionButton, {
                          children: text.confirm,
                          variant: "primary",
                        })}
                      </div>
                    ),
                  })}
                </div>
              </div>
            </section>

            <section className={styles.section!}>
              <p className={styles.sectionLabel!}>{text.today}</p>
              <div className={`${styles.card!} ${styles.rows!}`}>
                {createElement(TaskRow, {
                  detail:
                    locale === "ar" ? "سجلّ الأخطاء والتأخير" : "Fallback log and delay review",
                  due: text.due,
                  project: "Atlas Voice Intelligence",
                  source: "github",
                  title: locale === "ar" ? "التحقق من بديل البث" : "Validate streaming fallback",
                })}
                {createElement(TaskRow, {
                  detail:
                    locale === "ar"
                      ? "التشكيل وتبديل اللغات وتوحيد الأرقام"
                      : "Diacritics, code-switching, and number normalization",
                  due: text.due,
                  project: "Atlas Voice Intelligence",
                  source: "document",
                  title:
                    locale === "ar"
                      ? "مراجعة حالات النص العربي"
                      : "Review Arabic transcript edge cases",
                })}
              </div>
            </section>

            <section className={`${styles.section!} ${styles.continue!}`}>
              <p className={styles.sectionLabel!}>{text.continue}</p>
              <div className={`${styles.card!} ${styles.rows!}`}>
                {createElement(TaskRow, {
                  detail:
                    locale === "ar" ? "غير محجوب ولا توجد تبعيات" : "Unblocked · No dependencies",
                  project: "Atlas Voice Intelligence",
                  source: "research",
                  title: locale === "ar" ? "قياس ذاكرة المحادثة" : "Conversation memory benchmark",
                })}
              </div>
            </section>

            <section className={`${styles.section!} ${styles.changed!}`}>
              <p className={styles.sectionLabel!}>{text.changed}</p>
              <div className={`${styles.card!} ${styles.row!}`}>
                <span aria-hidden="true" className={styles.changeMark!}>
                  {createElement(ProductIcon, { name: "check" })}
                </span>
                <div className={styles.rowCopy!}>
                  <strong>
                    {locale === "ar"
                      ? "دُمج PR #182 واكتمل شرط المرحلة"
                      : "PR #182 merged; milestone condition satisfied"}
                  </strong>
                  <span className={styles.supporting!}>
                    GitHub commit <bdi>9c3a1d2</bdi> on main
                  </span>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function TaskRow({
  detail,
  due,
  project,
  source,
  title,
}: Readonly<{
  detail: string;
  due?: string;
  project: string;
  source: "document" | "github" | "research";
  title: string;
}>) {
  return (
    <div className={styles.row!}>
      <input aria-label={`Complete ${title}`} className={styles.checkbox!} type="checkbox" />
      <div className={styles.rowCopy!}>
        <strong>{title}</strong>
        <span className={styles.supporting!}>{detail}</span>
      </div>
      <span className={styles.supporting!}>{project}</span>
      {createElement(ProductIcon, { name: source })}
      <span className={styles.due!}>{due ?? "—"}</span>
    </div>
  );
}

export default {
  component: Foundation,
  parameters: { a11y: { test: "error" } },
  title: "Foundation/Command Brief",
};

export const EnglishDesktop = { args: { locale: "en", state: "ready" } };

export const ArabicRtl = {
  args: { locale: "ar", state: "ready" },
  globals: { locale: "ar" },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const review = canvas.getByRole("button", { name: "مراجعة المسودة" });
    await userEvent.click(review);
    const dialog = within(document.body).getByRole("dialog", { name: "مراجعة تحديث المشروع" });
    await expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect(review).toHaveFocus();
  },
};

export const Mobile390 = {
  args: { locale: "en", state: "ready" },
  parameters: {
    viewport: {
      defaultViewport: "mobile390",
      options: {
        mobile390: { name: "Mobile 390px", styles: { height: "844px", width: "390px" } },
      },
    },
  },
};

export const Loading = { args: { locale: "en", state: "loading" } };
export const Empty = { args: { locale: "en", state: "empty" } };

export const ErrorAndRecovery = {
  args: { locale: "en", state: "error" },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(canvas.getByText("Needs Your Decision")).toBeVisible();
  },
};

export const DisclosureInteraction = {
  render: () => (
    <div className={styles.canvas!}>
      {createElement(ProductDisclosure, {
        children: <p className={styles.supporting!}>Confirmed sources remain visible on review.</p>,
        defaultExpanded: true,
        title: "Source details",
      })}
    </div>
  ),
};
