import { afterEach, describe, expect, it, vi } from "vitest";

import { loadCaptureUpdateContext } from "./capture-update-context-api.js";

afterEach(() => vi.restoreAllMocks());

describe("loadCaptureUpdateContext", () => {
  it("loads only the server-authorized Project context through the protected same-origin route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          projects: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Evaluation System",
              workItems: [],
              workstreams: [],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const context = await loadCaptureUpdateContext();

    expect(fetch).toHaveBeenCalledWith("/api/daily-work/update-context", { method: "GET" });
    expect(context.projects[0]?.name).toBe("Evaluation System");
  });
});
