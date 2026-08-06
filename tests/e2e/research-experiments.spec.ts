import { expect, test } from "@playwright/test";

import { sealAuthCookie } from "../../apps/web/src/auth/oidc.js";
import {
  evaluationCycleId,
  installWorkspaceSession,
  otherEmployeeAccessToken,
  ownerId,
  projectId,
} from "./fixtures/workspace.js";

const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`;
const sessionSecret = "e2e-session-secret-with-at-least-32-characters";
const systemAdministratorAccessToken = "e2e-system-administrator-access-token";
const unrelatedManagerAccessToken = "e2e-unrelated-manager-access-token";
const researchId = "f3111111-1111-4111-8111-111111111111";
const unsupportedExperimentId = "f3222222-2222-4222-8222-222222222222";
const supportedExperimentId = "f3333333-3333-4333-8333-333333333333";
const sourceUrl = "https://github.com/example/atlas-research";
const screenshotDirectory = "docs/product/screenshots/engine/research-experiments";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context, request }) => {
  const reset = await request.post(`${apiBaseUrl}/__e2e/research/reset`, {
    headers: { "x-e2e-control": "research-experiments" },
  });
  expect(reset.status()).toBe(204);
  await installWorkspaceSession(context);
});

test("employee turns a cited source into confirmed research, two experiments, evidence, and applied learning", async ({
  page,
  request,
}) => {
  await page.goto(`/en/projects/${projectId}/research`);
  await expect(page.getByRole("heading", { name: "Research and experiments" })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/01-en-research-desktop.png`,
  });

  await page.getByLabel("What should the assistant investigate?").fill(sourceUrl);
  await page.getByRole("button", { name: "Investigate" }).click();
  await expect(page.getByRole("heading", { name: "Cited Project relevance review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why it may help" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mismatch" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uncertainty" })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/02-en-cited-source-review.png`,
  });

  const proposalSheet = page.getByRole("dialog", { name: "Edit proposals" });
  await expect(proposalSheet).toBeVisible();
  const unsuitable = proposalSheet
    .getByRole("group", { name: "Task proposal" })
    .getByRole("checkbox", { name: "Include this proposal" });
  await unsuitable.uncheck();
  await page.screenshot({ path: `${screenshotDirectory}/03-en-proposal-sheet.png` });

  expect((await readCheckpoint(request)).officialTaskCount).toBe(0);
  await proposalSheet.getByRole("button", { name: "Confirm selected proposals" }).click();
  await expect(page.getByRole("heading", { name: "Proposals confirmed" })).toBeVisible();

  const checkpoint = await readCheckpoint(request);
  expect(checkpoint).toMatchObject({
    research: { id: researchId, state: "CONCLUDED", decisionConfirmed: true },
    experiments: [
      { id: unsupportedExperimentId, outcome: "NOT_SUPPORTED", retained: true },
      {
        id: supportedExperimentId,
        outcome: "SUPPORTED",
        baselinePinned: true,
        measuresPinned: true,
        testCasesPinned: true,
        limitationsPinned: true,
      },
    ],
    evidence: { state: "CONFIRMED" },
    appliedLearning: { targetKind: "WORK_ITEM" },
    officialTaskCount: 0,
  });

  const failedExperiment = await page.request.get(
    `/api/research/experiments/${experimentHandle(unsupportedExperimentId, 5)}`,
  );
  expect(failedExperiment.status()).toBe(200);
  expect(await failedExperiment.json()).toMatchObject({
    state: "CONCLUDED",
    resultStatus: "FAILED",
    humanConclusion: expect.any(String),
  });

  const timeline = await page.request.get(
    `/api/daily-work/timeline?projectId=${projectId}&limit=10`,
  );
  expect(timeline.status()).toBe(200);
  expect(await timeline.json()).toMatchObject({
    items: expect.arrayContaining([
      expect.objectContaining({ kind: "research", title: "Research decision confirmed" }),
      expect.objectContaining({
        kind: "applied_learning",
        title: "Applied learning linked to an existing Task",
      }),
    ]),
  });

  await page.goto(`/en/evaluations/facts?cycle=${evaluationCycleId}&employee=${ownerId}`);
  await expect(page.getByRole("heading", { name: "Research and experiments" })).toBeVisible();
  await expect(page.getByText("Research decision", { exact: true })).toBeVisible();
  await expect(page.getByText("Applied learning", { exact: true })).toBeVisible();
  await expect(page.getByText(/rating|rank|productivity score|readiness percentage/iu)).toHaveCount(
    0,
  );
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/04-en-decision-applied-learning-facts.png`,
  });
});

test("research boundaries fail closed for unrelated roles, stale writes, blocked URLs, and unavailable AI", async ({
  page,
  request,
}) => {
  for (const accessToken of [
    otherEmployeeAccessToken,
    unrelatedManagerAccessToken,
    systemAdministratorAccessToken,
  ]) {
    const response = await request.get(`${apiBaseUrl}/api/v1/research/${researchId}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.status()).toBe(403);
  }

  const stale = await request.post(
    `${apiBaseUrl}/api/v1/research/source-reviews/f3444444-4444-4444-8444-444444444444/disposition`,
    {
      data: {
        disposition: "CONFIRM",
        expectedVersion: 1,
        proposalIds: [],
        reason: "Stale browser confirmation.",
      },
      headers: { authorization: "Bearer e2e-access-token" },
    },
  );
  expect(stale.status()).toBe(409);

  const blocked = await request.post(`${apiBaseUrl}/api/v1/research/source-reviews`, {
    data: {
      idempotencyKey: "blocked-private-url",
      scope: { projectId, workstreamId: null, workItemId: null },
      source: { kind: "URL", url: "http://127.0.0.1/private" },
    },
    headers: { authorization: "Bearer e2e-access-token" },
  });
  expect(blocked.status()).toBe(400);

  const disabled = await request.post(`${apiBaseUrl}/__e2e/research/ai-availability`, {
    data: { available: false },
    headers: { "x-e2e-control": "research-experiments" },
  });
  expect(disabled.status()).toBe(204);
  await page.goto(`/en/projects/${projectId}/research`);
  await page.getByLabel("What should the assistant investigate?").fill(sourceUrl);
  await page.getByRole("button", { name: "Investigate" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The review could not be prepared" }),
  ).toContainText("The review could not be prepared. Check the URL or try again.");
});

test("Arabic research checkpoint stays localized, RTL, and usable at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ar/projects/${projectId}/research`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "البحث والتجارب" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/05-ar-research-mobile.png`,
  });
});

async function readCheckpoint(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get(`${apiBaseUrl}/__e2e/research/checkpoint`, {
    headers: { "x-e2e-control": "research-experiments" },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

function experimentHandle(id: string, revision: number): string {
  return sealAuthCookie(
    {
      kind: "context_handle",
      action: "experiment",
      id,
      projectId,
      revision,
      expiresAt: Date.now() + 15 * 60_000,
    },
    sessionSecret,
  );
}
