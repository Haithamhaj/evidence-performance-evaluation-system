import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConnectedContextView } from "./connected-context.js";
import { SourceReviewSheet, SourceReviewSheetView } from "./source-review-sheet.js";
import {
  GoogleWorkspaceCardView,
  localizedConnectionReturnUri,
} from "../settings/connections/google-workspace-card.js";

const project = { id: "11111111-1111-4111-8111-111111111111", name: "Atlas Delivery" };
const item = {
  id: "22222222-2222-4222-8222-222222222222",
  provider: "GOOGLE_GMAIL" as const,
  occurredAt: "2026-07-20T08:30:00.000Z",
  title: "[Synthetic] Project decision",
  summary: "A short private summary.",
  sourceUrl: "https://mail.google.com/mail/u/0/#inbox/synthetic",
  privacy: "PRIVATE" as const,
  excluded: false,
  projectId: "11111111-1111-4111-8111-111111111111",
  sourceExclusion: {
    provider: "GOOGLE_GMAIL" as const,
    kind: "GMAIL_LABEL" as const,
    providerExclusionId: "synthetic-project-context",
    excluded: false,
  },
};

describe("ConnectedContextView", () => {
  it("keeps source context private and separate from completed work", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ConnectedContextView, {
        catalog,
        context: {
          mode: "synthetic",
          synthetic: true,
          connection: { status: "connected", lastSuccessfulSyncAt: "2026-07-20T10:00:00.000Z" },
          items: [item],
        },
        onReview: () => undefined,
        projects: [project],
      }),
    );

    expect(markup).toContain("Private workspace context");
    expect(markup).toContain("Synthetic local data");
    expect(markup).toContain("Project decision");
    expect(markup).toContain("Gmail context");
    expect(markup).toContain("Last successful sync");
    expect(markup).toContain("Atlas Delivery");
    expect(markup).toContain("Private to you");
    expect(markup).not.toContain("Done");
  });

  it("keeps excluded sources visibly excluded instead of treating them as work", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ConnectedContextView, {
        catalog,
        context: {
          mode: "synthetic",
          synthetic: true,
          connection: { status: "connected", lastSuccessfulSyncAt: "2026-07-20T10:00:00.000Z" },
          items: [{ ...item, excluded: true }],
        },
        onReview: () => undefined,
        projects: [project],
      }),
    );

    expect(markup).toContain("Excluded from context");
    expect(markup).not.toContain("status-done");
  });
});

describe("SourceReviewSheetView", () => {
  it("uses an accessible mobile bottom sheet with reversible manual Project actions", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(SourceReviewSheetView, {
        catalog,
        item,
        linkedProject: project,
        projects: [project],
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("connectedContextBottomSheet");
    expect(markup).toContain("Unlink from Atlas Delivery");
    expect(markup).toContain("Link to Project");
    expect(markup).toContain("Prepare smart review");
    expect(markup).toContain("Nothing becomes shared work until you confirm it.");
    expect(markup).toContain("Hide this item from review");
    expect(markup).toContain("Exclude this Gmail label from future sync");
    expect(markup).not.toContain(item.id);
  });
});

describe("SourceReviewSheet", () => {
  it("restores the persisted Project link when the employee reopens source review", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(SourceReviewSheet, {
        catalog,
        item,
        projects: [project],
        onClose: () => undefined,
        onChanged: async () => undefined,
      }),
    );

    expect(markup).toContain("Unlink from Atlas Delivery");
  });
});

describe("GoogleWorkspaceCardView", () => {
  it("starts from the actual localized Connections route", () => {
    expect(localizedConnectionReturnUri("http://localhost:3000", "ar")).toBe(
      "http://localhost:3000/ar/settings/connections",
    );
    expect(localizedConnectionReturnUri("http://localhost:3000", "en")).toBe(
      "http://localhost:3000/en/settings/connections",
    );
  });

  it("explains private storage and offers disconnect recovery without exposing credentials", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(GoogleWorkspaceCardView, {
        catalog,
        status: "connected",
        stale: true,
        lastSuccessfulSyncAt: "2026-07-20T10:00:00.000Z",
      }),
    );

    expect(markup).toContain("Last successful sync");
    expect(markup).toContain('dateTime="2026-07-20T10:00:00.000Z"');
    expect(markup).toContain("Context may be out of date");
    expect(markup).toContain("Disconnect and hide private context");
    expect(markup).toContain("Deletion will follow the approved retention and deletion policy");
    expect(markup).toContain("Managers and other roles cannot view it");
    expect(markup).not.toMatch(/accessToken|refreshToken|credentialRef|oauth/i);
  });
});
