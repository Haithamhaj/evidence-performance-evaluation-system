import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UpdateComposerView } from "./update-composer-view.js";
import { updateErrorCatalogKey } from "./update-composer.js";

const projectId = crypto.randomUUID();
const workstreamId = crypto.randomUUID();
const workItemId = crypto.randomUUID();
const context = {
  projects: [
    {
      id: projectId,
      name: "منصة التقييم التجريبية",
      workstreams: [{ id: workstreamId, name: "جاهزية API" }],
      workItems: [{ id: workItemId, title: "إغلاق مسار القبول", workstreamId }],
    },
  ],
};

describe("UpdateComposerView", () => {
  it("starts from a required Project while Workstream and Work Item remain optional", async () => {
    const catalog = await getCatalog("ar");
    const markup = renderToStaticMarkup(
      createElement(UpdateComposerView, {
        catalog,
        stage: {
          kind: "entry",
          context,
          selection: { projectId, workstreamId: null, workItemId: null },
          rawText: "",
          sources: [],
        },
      }),
    );

    expect(markup).toMatch(/<select[^>]*name="projectId"[^>]*required/u);
    expect(markup).toMatch(/<select[^>]*name="workstreamId"/u);
    expect(markup).toMatch(/<select[^>]*name="workItemId"/u);
    expect(markup).not.toMatch(/<select[^>]*name="workItemId"[^>]*required/u);
    expect(markup).toContain("منصة التقييم التجريبية");
  });

  it("shows the evolving draft beside one clarification question", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(UpdateComposerView, {
        catalog,
        stage: {
          kind: "draft_with_question",
          context,
          selection: { projectId, workstreamId, workItemId },
          question: "What result can be verified?",
          remainingFieldCount: 2,
          draft: {
            summary: "Acceptance path prepared",
            result: "The final result still needs clarification",
            blocker: null,
            nextAction: "Confirm the acceptance result",
            contributionContext: "Prepared and reviewed the path",
            documentationNeeds: ["Client acceptance record"],
            comparison: { explanation: "This is the first update." },
          },
        },
      }),
    );

    expect(markup).toContain("Acceptance path prepared");
    expect(markup).toContain("What result can be verified?");
    expect(markup).toContain("Client acceptance record");
    expect(markup).not.toContain("rating");
    expect(markup).not.toContain("productivity");
  });

  it("shows all source choices on the first screen without pretending future sources are active", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(UpdateComposerView, {
        catalog,
        stage: {
          kind: "entry",
          context,
          selection: { projectId, workstreamId: null, workItemId: null },
          rawText: "",
          sources: [{ kind: "github_snapshot" }],
        },
      }),
    );

    for (const label of [
      "Write update",
      "Voice update",
      "Upload file",
      "Image or screenshot",
      "Paste code",
      "CLI snapshot",
      "URL",
      "GitHub snapshot",
      "Connected GitHub",
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("Available in a later step");
    expect(markup).toMatch(/<textarea[^>]*name="sourceGithub"/u);
    expect(markup).toMatch(/<input[^>]*multiple[^>]*type="file"[^>]*name="sourceFiles"/u);
    expect(markup).not.toMatch(/<textarea[^>]*name="rawText"[^>]*required/u);
  });

  it.each([
    [400, "updates.error.validation"],
    [401, "updates.error.session"],
    [403, "updates.error.scope"],
    [409, "updates.error.stale"],
    [413, "updates.error.size"],
    [415, "updates.error.type"],
    [422, "updates.error.ai"],
    [503, "updates.error.dependency"],
  ] as const)("maps status %s to the precise recovery message", (status, key) => {
    expect(updateErrorCatalogKey(status)).toBe(key);
  });
});
