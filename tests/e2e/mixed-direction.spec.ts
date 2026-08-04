import { expect, test } from "@playwright/test";

import { installWorkspaceSession, projectId, workstreamId } from "./fixtures/workspace.js";

test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("isolates technical Workstream evidence as LTR inside the Arabic page", async ({ page }) => {
  await page.goto(`/ar/projects/${projectId}/workstreams/${workstreamId}`);

  for (const kind of ["code", "hash"]) {
    const sample = page.locator(`[data-bidi-kind="${kind}"]`);
    await expect(sample.first()).toHaveAttribute("dir", "ltr");
    await expect(sample.first()).toHaveCSS("direction", "ltr");
  }
});

test("technical evidence does not change the Arabic page direction", async ({ page }) => {
  await page.goto(`/ar/projects/${projectId}/workstreams/${workstreamId}`);

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("main")).not.toHaveAttribute("dir", /.+/u);
});
