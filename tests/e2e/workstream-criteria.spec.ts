import { expect, test } from "@playwright/test";

import {
  historicalWorkstreamId,
  installWorkspaceSession,
  projectId,
  sourceHash,
  workstreamId,
} from "./fixtures/workspace.js";

test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("shows source-bound criteria and freezes the contributor response", async ({
  page,
  request,
}) => {
  await page.goto(`/ar/projects/${projectId}/workstreams/${workstreamId}`);

  await expect(page.locator(".criteriaList > li")).toHaveCount(2);
  await expect(page.getByText("١ / ٢")).toBeVisible();
  const hash = page.getByText(sourceHash);
  await expect(hash).toHaveAttribute("dir", "ltr");

  await page.getByRole("button", { name: "إقرار" }).click();
  await expect(page.getByText("٢ / ٢")).toBeVisible();
  await expect(page.getByRole("button", { name: "إقرار" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "اعتراض" })).toHaveCount(0);
  const duplicate = await request.post(
    `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}/api/v1/dynamic-criteria/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/responses`,
    {
      data: { action: "object", reason: "لا يمكن استبدال الاستجابة المجمدة." },
      headers: { authorization: "Bearer e2e-access-token" },
    },
  );
  expect(duplicate.status()).toBe(409);
  await expect(page.getByText(/rating|rank|productivity|percentage/iu)).toHaveCount(0);
});

test("shows only the frozen criteria snapshot after current workstream access ends", async ({
  page,
}) => {
  await page.goto(`/ar/projects/${projectId}/workstreams/${historicalWorkstreamId}`);

  await expect(page.getByRole("heading", { name: "معايير التحليل", level: 1 })).toBeVisible();
  await expect(page.locator(".criteriaList > li")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "إقرار" })).toBeVisible();
  await expect(page.getByText("الأشخاص الحاليون")).toHaveCount(0);
  await expect(page.getByText("إصدارات المستند")).toHaveCount(0);
});
