/* eslint-disable no-unused-vars */
"use client";

import { getCatalogSync } from "@evaluation/localization";
import { createElement } from "react";

import { IntelligentToday, type IntelligentTodayGateway } from "./intelligent-today";
import type { WebPreparedExperienceComposition } from "../../platform/experience-orchestration-contracts";

const projectId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const suggestionHandle = `opaque-project_suggestion-${"x".repeat(40)}`;
const projectHandle = `opaque-project-${"y".repeat(40)}`;

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

export function TodayStory({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  return createElement(IntelligentToday, {
    catalog: getCatalogSync(locale),
    gateway,
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
