import { expect, test } from "@playwright/test";

import { installWorkspaceSession } from "./fixtures/workspace.js";

const dogfoodProjectId = "d1111111-1111-4111-8111-111111111111";

test("Codex works on the real evaluation-system Project without fabricated progress", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context);
  await page.goto("/en/my-work");

  await expect(page.getByRole("heading", { name: "Good morning, Codex" })).toBeVisible();
  const project = page.getByRole("article", {
    name: "Evidence Performance Evaluation System",
  });
  await expect(project).toBeVisible();
  await expect(project.getByText("Needs a progress contract").first()).toBeVisible();
  await expect(project.getByText("Work experience expansion")).toBeVisible();

  await page.goto(`/en/projects/${dogfoodProjectId}`);
  await expect(
    page.getByRole("heading", { name: "Evidence Performance Evaluation System" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Needs a progress contract confirmed Project progress"),
  ).toBeVisible();
  await expect(page.getByText("GitHub suggested evidence").first()).toBeVisible();
  await expect(page.getByText(/employee confirmation required/iu).first()).toBeVisible();

  await page.goto(`/en/tasks?view=my&layout=list&project=${dogfoodProjectId}`);
  await expect(page.locator("select").nth(1)).toHaveValue(dogfoodProjectId);
  await expect(page.getByText("Review Phase 2 Work query bundle")).toBeVisible();
  await expect(page.getByText("Implement safe inline Task edits")).toBeVisible();

  await page.getByRole("button", { name: /Review Phase 2 Work query bundle/u }).click();
  await expect(page.getByRole("heading", { name: "Activity and evidence" })).toBeVisible();
  await expect(page.getByText("Work query and keyboard bundle implemented")).toBeVisible();
  await expect(
    page.getByText("GitHub suggested evidence · employee confirmation required"),
  ).toBeVisible();
  await expect(page.getByText(/does not score Codex or change Project progress/u)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  const task = page.getByRole("listitem").filter({ hasText: "Implement safe inline Task edits" });
  await task.getByRole("button", { name: "Edit task" }).click();
  const editor = task.getByRole("form", { name: "Edit task" });
  await editor.getByLabel("Task title").fill("Implement safe inline Task edits — Codex");
  await editor.getByLabel("Priority").selectOption("urgent");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Implement safe inline Task edits — Codex")).toBeVisible();
});
