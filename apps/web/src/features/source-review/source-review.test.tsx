/* eslint-disable no-unused-vars */
// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { getCatalogSync } from "@evaluation/localization";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SourceReview,
  type SourceReviewGateway,
  type SourceReviewSource,
} from "./source-review.js";

const employeeId = "11111111-1111-4111-8111-111111111111";
const atlasId = "22222222-2222-4222-8222-222222222222";
const novaId = "33333333-3333-4333-8333-333333333333";
const googleId = "44444444-4444-4444-8444-444444444444";
const githubEventId = "55555555-5555-4555-8555-555555555555";
const evidenceId = "66666666-6666-4666-8666-666666666666";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SourceReview", () => {
  it("keeps Google private, shows GitHub as suggested, and retains the manual fallback", async () => {
    renderSource();

    expect(await screen.findByText("Customer decision email")).toBeInTheDocument();
    expect(screen.getByText("PR #184 updated authentication")).toBeInTheDocument();
    expect(screen.getByText("CLI snapshot from the staging check")).toBeInTheDocument();
    expect(screen.getAllByText("Private to you")).toHaveLength(2);
    expect(screen.getByText("Suggested only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add manual evidence" })).toBeInTheDocument();
    expect(screen.queryByText(/rating|readiness|progress score/iu)).not.toBeInTheDocument();
  });

  it("keeps manual evidence available when connected sources cannot load", async () => {
    renderSource(service({ load: vi.fn().mockRejectedValue(new Error("offline")) }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Connected sources are unavailable");
    expect(screen.getByRole("button", { name: "Add manual evidence" })).toBeInTheDocument();
    expect(screen.getByText("CLI snapshot from the staging check")).toBeInTheDocument();
  });

  it("corrects the private Project link before opening a separate evidence draft", async () => {
    const gateway = service();
    const user = userEvent.setup();
    renderSource(gateway);

    await user.click(await screen.findByRole("button", { name: /Customer decision email/u }));
    await user.selectOptions(screen.getByLabelText("Project"), novaId);
    await user.click(screen.getByRole("button", { name: "Confirm Project link" }));

    expect(gateway.linkGoogleProject).toHaveBeenCalledWith({
      sourceId: googleId,
      projectId: novaId,
      reason: "Employee confirmed source Project during evidence review",
    });

    await user.click(screen.getByRole("button", { name: "Review as evidence" }));
    expect(screen.getByRole("dialog", { name: "Review evidence" })).toBeInTheDocument();
    expect(screen.getByLabelText("Source content")).toHaveValue(
      "Customer approved the revised launch sequence.",
    );
    expect(
      screen.getByText(/review the claim and contribution context before confirmation/iu),
    ).toBeInTheDocument();
  });

  it("creates only a draft first and confirms GitHub evidence only after employee review", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/daily-work/evidence/github-suggestions") {
        return Response.json({ id: evidenceId });
      }
      if (path === `/api/daily-work/evidence/${evidenceId}`) {
        const revised = fetcher.mock.calls.some(([url]) => String(url).endsWith("/revisions"));
        return Response.json(review(revised ? 2 : 1));
      }
      if (path.endsWith("/revisions")) return Response.json({ ok: true });
      if (path.endsWith("/confirm")) return Response.json({ ok: true });
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetcher);
    renderSource();

    await user.click(await screen.findByRole("button", { name: /PR #184/u }));
    await user.click(screen.getByRole("button", { name: "Confirm Project link" }));
    await user.click(screen.getByRole("button", { name: "Review as evidence" }));
    await user.type(screen.getByLabelText("Contribution context"), "Implemented and verified it.");
    await user.click(screen.getByRole("button", { name: "Create review draft" }));

    const confirm = await screen.findByRole("button", { name: "Confirm evidence" });
    expect(confirm).toBeDisabled();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/daily-work/evidence/github-suggestions",
      expect.objectContaining({ body: expect.stringContaining('"executionMode":"manual"') }),
    );
    expect(fetcher).not.toHaveBeenCalledWith(
      expect.stringContaining("/confirm"),
      expect.anything(),
    );

    await user.click(screen.getByRole("button", { name: "Save my edits" }));
    const enabledConfirm = await screen.findByRole("button", { name: "Confirm evidence" });
    await waitFor(() => expect(enabledConfirm).toBeEnabled());
    await user.click(enabledConfirm);

    expect(fetcher).toHaveBeenCalledWith(
      `/api/daily-work/evidence/${evidenceId}/confirm`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("Evidence confirmed by you")).toBeInTheDocument();
    expect(
      screen.getByText("No Project progress or employee evaluation changed."),
    ).toBeInTheDocument();
  });

  it("renders the Arabic owner-private journey in RTL", async () => {
    renderSource(service(), "ar");

    const region = await screen.findByRole("region", { name: "مراجعة المصادر" });
    expect(region).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("button", { name: "إضافة دليل يدوي" })).toBeInTheDocument();
    expect(screen.getAllByText("خاص بك")).toHaveLength(2);
  });
});

function renderSource(gateway = service(), locale: "ar" | "en" = "en") {
  return render(
    <SourceReview
      catalog={getCatalogSync(locale)}
      gateway={gateway}
      locale={locale}
      manualSources={[
        {
          id: "77777777-7777-4777-8777-777777777777",
          employeeId,
          text: "CLI snapshot from the staging check",
          projectId: atlasId,
          createdAt: "2026-08-12T08:30:00.000Z",
        },
      ]}
      projects={[
        { id: atlasId, name: "Atlas Delivery" },
        { id: novaId, name: "Nova Research" },
      ]}
    />,
  );
}

function service(overrides: Partial<SourceReviewGateway> = {}) {
  const sources: readonly SourceReviewSource[] = [
    {
      kind: "google",
      id: googleId,
      provider: "GOOGLE_GMAIL",
      title: "Customer decision email",
      summary: "Customer approved the revised launch sequence.",
      sourceUrl: "https://mail.google.com/mail/u/0/#inbox/message",
      occurredAt: "2026-08-12T08:00:00.000Z",
      projectId: atlasId,
      excluded: false,
    },
    {
      kind: "github",
      id: githubEventId,
      title: "PR #184 updated authentication",
      summary: "Verified GitHub fact from the protected project timeline.",
      occurredAt: "2026-08-12T09:00:00.000Z",
      projectId: atlasId,
      projectName: "Atlas Delivery",
    },
  ];
  return {
    load: vi.fn().mockResolvedValue(sources),
    linkGoogleProject: vi.fn().mockResolvedValue(undefined),
    excludeGoogleSource: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as SourceReviewGateway & {
    load: ReturnType<typeof vi.fn>;
    linkGoogleProject: ReturnType<typeof vi.fn>;
    excludeGoogleSource: ReturnType<typeof vi.fn>;
  };
}

function review(revision: number) {
  return {
    id: evidenceId,
    revisionId: crypto.randomUUID(),
    projectId: atlasId,
    workstreamId: null,
    workItemId: null,
    state: "draft",
    revision,
    revisionKind: revision === 1 ? "ai_draft" : "employee_edit",
    sourceKind: "url",
    supportedClaim: "PR #184 updated authentication",
    contributionContext: "Implemented and verified it.",
    executionMode: "ai_assisted",
    sourceText: null,
    sourceUrl: "https://github.com/example/repo/pull/184",
    mediaType: null,
    sourceProvenance: "github_automated",
    project: { id: atlasId, name: "Atlas Delivery" },
    workstream: null,
    workItem: null,
    relatedKpiComponents: [],
    relatedCriteria: [],
    verificationState: "unverified",
  };
}
