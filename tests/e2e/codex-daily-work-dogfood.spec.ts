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
  await expect(project.getByText("Work Agent capability closure")).toBeVisible();

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
  await expect(page.getByText("Close Work Agent capability gaps", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Complete Work performance and pagination benchmark", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prepared for You" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Continue Work Agent capability closure" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open prepared Task" }).click();
  await expect(page).toHaveURL(/item=/u);
  await expect(page.getByRole("dialog", { name: "Task details" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: /Close Work Agent capability gaps/u }).click();
  await expect(page.getByRole("heading", { name: "Activity and evidence" })).toBeVisible();
  await expect(
    page.getByText("Performance paging and the Work benchmark are complete"),
  ).toBeVisible();
  await expect(
    page.getByText("GitHub suggested evidence · employee confirmation required"),
  ).toBeVisible();
  await expect(page.getByText(/does not score Codex or change Project progress/u)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ask about this Task" })).toBeVisible();
  await page
    .getByLabel("Ask a question about this Task")
    .fill("What remains before this Task can move to review?");
  await page.getByRole("button", { name: "Ask assistant" }).click();
  await expect(
    page.getByText(/remaining step is to verify the free-form assistant/iu),
  ).toBeVisible();
  await expect(page.getByText(/Authorized sources: 3/u)).toBeVisible();
  await page.getByRole("button", { name: "Prepare In review" }).click();
  await expect(page.getByRole("heading", { name: "Prepared status change" })).toBeVisible();
  await expect(page.getByText(/In progress → In review/u)).toBeVisible();
  await expect(page.getByText("In progress", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Summarize linked activity" }).click();
  await expect(page.getByText(/1 linked update and 1 evidence item/u)).toBeVisible();
  await expect(page.getByText(/GitHub evidence is still only suggested/u)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: /Complete Codex employee journey acceptance/u }).click();
  const dependentTask = page.getByRole("dialog", { name: "Task details" });
  await expect(page.getByText("Blocked by an unfinished Task.")).toBeVisible();
  await expect(page.getByText("Close Work Agent capability gaps").last()).toBeVisible();
  await expect(dependentTask.getByRole("option", { name: "Ready" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("link", { name: "Board" }).click();
  await expect(page).toHaveURL(/layout=board/u);
  await expect(page.getByRole("heading", { name: "Planned 1" })).toBeVisible();
  await page.screenshot({ path: "tmp/playwright/codex-work-board.png", fullPage: true });
  const acceptance = "Complete Codex employee journey acceptance";
  await expect(
    page.getByLabel(`Move ${acceptance} to`).getByRole("option", { name: "Ready" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "List" }).click();

  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/layout=calendar/u);
  await expect(page.getByText("Private Google Calendar context")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review Command Brief Work journey" }),
  ).toBeVisible();
  const reviewTask = page.getByRole("form", {
    name: "Reschedule Close Work Agent capability gaps",
  });
  await reviewTask.getByLabel("Due date and time").fill("2026-08-18T12:30");
  await reviewTask.getByRole("button", { name: "Save date" }).click();
  await expect(page.getByRole("heading", { name: /Aug 18/u })).toBeVisible();
  await page.screenshot({ path: "tmp/playwright/codex-work-calendar.png", fullPage: true });
  await page.getByRole("link", { name: "List" }).click();

  const task = page.getByRole("listitem").filter({ hasText: "Close Work Agent capability gaps" });
  await task.getByRole("button", { name: "Edit task" }).click();
  const editor = task.getByRole("form", { name: "Edit task" });
  await editor.getByLabel("Task title").fill("Close Work Agent capability gaps — Codex");
  await editor.getByLabel("Priority").selectOption("urgent");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Close Work Agent capability gaps — Codex", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByLabel("Task title").fill("Record Codex dogfood feedback");
  await page.getByLabel("Project is required").selectOption(dogfoodProjectId);
  await expect(
    page.getByText("Private draft saved on this device until the Task is created."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByRole("heading", { name: "Record Codex dogfood feedback" })).toBeVisible();
  await expect(page).toHaveURL(/item=/u);
});
