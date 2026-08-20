/* eslint-disable no-unused-vars */
"use client";

import type { Catalog } from "@evaluation/localization";
import { createElement } from "react";

import { IntelligentToday, type IntelligentTodayGateway } from "./intelligent-today";
import { ContextDecisionError } from "../../platform/context-intelligence-api";
import type { WebPreparedExperienceComposition } from "../../platform/experience-orchestration-contracts";

const projectId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const suggestionHandle = `opaque-project_suggestion-${"x".repeat(40)}`;
const projectHandle = `opaque-project-${"y".repeat(40)}`;
const todayCatalogs = {
  ar: {
    "actions.retry": "إعادة المحاولة",
    "contextReview.confirmLinkReason": "أكد الموظف رابط المشروع المعدّ",
    "contextReview.correctLinkReason": "اختار الموظف رابط مشروع مختلفًا",
    "contextReview.rejectLinkReason": "رفض الموظف رابط المشروع المعدّ",
    "myWork.group.needs_my_action": "يحتاج تدخلي",
    "myWork.group.overdue": "متأخر",
    "myWork.group.today": "اليوم",
    "myWork.status.ready": "جاهز للبدء",
    "tasks.selectProject": "اختر مشروعًا",
    "today.intelligent.chooseProject": "اختر مشروعًا آخر",
    "today.intelligent.clearBody": "لا شيء يحتاج تدخلك. يمكنك إضافة ملاحظة أو فتح العمل كالمعتاد.",
    "today.intelligent.clearTitle": "أمورك واضحة الآن",
    "today.intelligent.confirm": "تأكيد",
    "today.intelligent.consequence": "ما الذي سيحدث",
    "today.intelligent.correct": "تصحيح",
    "today.intelligent.decisionError": "لم يُحفظ القرار. ما زال الاقتراح موجودًا؛ حاول مجددًا.",
    "today.intelligent.decisionSaved": "تم حفظ القرار.",
    "today.intelligent.dismiss": "تجاهل",
    "today.intelligent.dismissed": "تم تجاهل الاقتراح وبقي المصدر دون تغيير.",
    "today.intelligent.draftBody": "تفاصيل المسودة المجهزة",
    "today.intelligent.draftTitle": "عنوان المسودة المجهزة",
    "today.intelligent.eyebrow": "اليوم",
    "today.intelligent.freshness": "حداثة المصدر",
    "today.intelligent.freshnessUnknown": "عنصر مراجعة حالي؛ وقت المصدر غير متاح",
    "today.intelligent.linkConsequence":
      "ستربط مراجعة هذا الاقتراح سياق المصدر الخاص بالمشروع المحدد فقط بعد تأكيدك.",
    "today.intelligent.loadError": "أحد المصادر الذكية غير متاح. ما زال عملك الحالي متاحًا أدناه.",
    "today.intelligent.loading": "نجهز موجزك اليومي المخوّل…",
    "today.intelligent.needsDecision": "يحتاج قرارك",
    "today.intelligent.prepared": "مجهز لك",
    "today.intelligent.preparedStale":
      "هذه المسودة مبنية على مصدر قديم. راجع المصدر قبل الاعتماد عليها.",
    "today.intelligent.provider.GOOGLE_CALENDAR": "Google Calendar",
    "today.intelligent.provider.GOOGLE_GMAIL": "Gmail",
    "today.intelligent.provider.private": "مصدر خاص",
    "today.intelligent.reload": "تحميل العنصر الحالي",
    "today.intelligent.source": "المصدر",
    "today.intelligent.source.authorized": "سياق عمل مخوّل",
    "today.intelligent.source.projectSuggestion": "اقتراح مشروع",
    "today.intelligent.source.workItem": "عنصر عمل",
    "today.intelligent.stale": "هذا القرار قديم. حمّل العنصر الحالي قبل المحاولة مجددًا.",
    "today.intelligent.subtitle": "ابدأ بقرار واحد، ثم تابع العمل المهم لهذا اليوم.",
    "today.intelligent.title": "موجز يومك",
    "today.intelligent.why": "لماذا",
  },
  en: {
    "actions.retry": "Try again",
    "contextReview.confirmLinkReason": "Employee confirmed the prepared Project link",
    "contextReview.correctLinkReason": "Employee selected a different Project link",
    "contextReview.rejectLinkReason": "Employee rejected the prepared Project link",
    "myWork.group.needs_my_action": "Needs my action",
    "myWork.group.overdue": "Overdue",
    "myWork.group.today": "Today",
    "myWork.status.ready": "Ready",
    "tasks.selectProject": "Select a project",
    "today.intelligent.chooseProject": "Choose another Project",
    "today.intelligent.clearBody":
      "Nothing needs your action. You can capture a note or open Work normally.",
    "today.intelligent.clearTitle": "You’re clear right now",
    "today.intelligent.confirm": "Confirm",
    "today.intelligent.consequence": "Consequence",
    "today.intelligent.correct": "Correct",
    "today.intelligent.decisionError":
      "The decision was not saved. The suggestion is still here; try again.",
    "today.intelligent.decisionSaved": "Decision saved.",
    "today.intelligent.dismiss": "Dismiss",
    "today.intelligent.dismissed": "Suggestion dismissed. The source remains unchanged.",
    "today.intelligent.draftBody": "Prepared draft details",
    "today.intelligent.draftTitle": "Prepared draft title",
    "today.intelligent.eyebrow": "Today",
    "today.intelligent.freshness": "Freshness",
    "today.intelligent.freshnessUnknown": "Current review item; source time unavailable",
    "today.intelligent.linkConsequence":
      "Reviewing this link will connect the private source context to the selected Project only after your confirmation.",
    "today.intelligent.loadError":
      "One smart source is unavailable. Your current work is still available below.",
    "today.intelligent.loading": "Preparing your authorized daily brief…",
    "today.intelligent.needsDecision": "Needs Your Decision",
    "today.intelligent.prepared": "Prepared for You",
    "today.intelligent.preparedStale":
      "This prepared draft is based on a stale source. Review the source before relying on it.",
    "today.intelligent.provider.GOOGLE_CALENDAR": "Google Calendar",
    "today.intelligent.provider.GOOGLE_GMAIL": "Gmail",
    "today.intelligent.provider.private": "Private source",
    "today.intelligent.reload": "Reload current item",
    "today.intelligent.source": "Source",
    "today.intelligent.source.authorized": "Authorized work context",
    "today.intelligent.source.projectSuggestion": "Project suggestion",
    "today.intelligent.source.workItem": "Work item",
    "today.intelligent.stale":
      "This decision is out of date. Reload the current item before trying again.",
    "today.intelligent.subtitle":
      "Start with one decision, then continue the work that matters today.",
    "today.intelligent.title": "Your daily brief",
    "today.intelligent.why": "Why",
  },
} as const;

const snapshot: import("@evaluation/contracts").DailyWorkspaceSnapshot = {
  needsMyAction: [],
  today: [
    {
      id: taskId,
      projectId,
      workstreamId: null,
      title: "Validate streaming fallback",
      description: "",
      status: "ready",
      priority: "high",
      assigneeId: "33333333-3333-4333-8333-333333333333",
      dueAt: "2026-08-12T12:00:00.000Z",
      requirements: [],
      acceptanceConditions: [],
      blocker: null,
      nextAction: "Retry the protected stream",
      version: 1,
      createdAt: "2026-08-12T07:00:00.000Z",
      updatedAt: "2026-08-12T08:00:00.000Z",
      checklist: [],
      collaboratorIds: [],
      allowedActions: ["edit"],
    },
  ],
  overdue: [],
  reviewQueue: [],
  inbox: [],
  projectPulse: [
    {
      id: projectId,
      name: "Atlas Voice Intelligence",
      status: "active",
      progress: { state: "awaiting_contract" },
    },
  ],
  upcoming: [],
};

const queue = {
  items: [
    {
      kind: "project_match" as const,
      handle: suggestionHandle,
      projectName: "Atlas Voice Intelligence",
      explanation: "The source describes the approved authentication scope.",
      source: {
        provider: "GOOGLE_GMAIL" as const,
        observedAt: "2026-08-12T08:00:00.000Z",
        title: "API authentication follow-up",
        summary: "The client confirmed the endpoint scope.",
        sourceUrl: "https://mail.google.com/example",
      },
    },
  ],
  projects: [{ handle: projectHandle, name: "Atlas Voice Intelligence" }],
};

const prepared: WebPreparedExperienceComposition = {
  state: "prepared",
  items: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      schemaVersion: "experience-prepared-output.v1",
      state: "prepared",
      kind: "next_action",
      sourceReferences: [`work-item:${taskId}`],
      why: "This authorized Task needs your attention today.",
      freshness: {
        status: "fresh",
        sourceObservedAt: "2026-08-12T08:00:00.000Z",
        preparedAt: "2026-08-12T08:05:00.000Z",
      },
      consequence: "Nothing changes until you act.",
      editableDraft: {
        title: "Validate streaming fallback",
        body: "Retry the protected stream",
      },
      assistance: {
        mode: "deterministic",
        label: "Selected from your authorized Today data without an AI result.",
        routeTrace: null,
      },
      correlationId: "55555555-5555-4555-8555-555555555555",
    },
  ],
};

const gateway: IntelligentTodayGateway = {
  confirm: async () => undefined,
  correct: async () => undefined,
  dismiss: async () => undefined,
  loadDecisionQueue: async () => queue,
  loadPrepared: async () => prepared,
};

const staleGateway: IntelligentTodayGateway = {
  ...gateway,
  correct: async () => {
    throw new ContextDecisionError(409);
  },
};

export function TodayStory({
  gatewayOverride = gateway,
  locale,
}: Readonly<{
  gatewayOverride?: IntelligentTodayGateway;
  locale: "ar" | "en";
}>) {
  return createElement(IntelligentToday, {
    catalog: todayCatalogs[locale] as unknown as Catalog,
    gateway: gatewayOverride,
    locale,
    onTaskSelect: () => undefined,
    snapshot,
  });
}

export default {
  component: TodayStory,
  parameters: { a11y: { test: "error" }, layout: "padded" },
  title: "Today/Intelligent Today",
};

export const EmployeeEnglish = { args: { locale: "en" } };
export const EmployeeArabic = { args: { locale: "ar" } };
export const StaleRecovery = { args: { gatewayOverride: staleGateway, locale: "en" } };
export const EmployeeArabicMobile = {
  args: { locale: "ar" },
  parameters: {
    viewport: {
      defaultViewport: "mobile390",
      options: {
        mobile390: { name: "Mobile 390px", styles: { height: "844px", width: "390px" } },
      },
    },
  },
};
