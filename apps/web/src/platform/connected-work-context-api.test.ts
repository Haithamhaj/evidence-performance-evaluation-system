import { describe, expect, it, vi } from "vitest";

import {
  listConnectedWorkContext,
  setContextSourceExclusion,
} from "./connected-work-context-api.js";

describe("connected work context browser gateway", () => {
  it("loads private context through the same-origin gateway without a browser bearer token", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: "synthetic",
          synthetic: true,
          connection: { status: "disconnected", lastSuccessfulSyncAt: null },
          items: [],
        }),
        { status: 200 },
      ),
    );

    await expect(listConnectedWorkContext()).resolves.toEqual({
      mode: "synthetic",
      synthetic: true,
      connection: { status: "disconnected", lastSuccessfulSyncAt: null },
      items: [],
    });
    expect(request).toHaveBeenCalledWith("/api/workspace/connected-work/items", {
      cache: "no-store",
      headers: { accept: "application/json" },
      method: "GET",
    });
  });

  it("changes a source-scope exclusion through the narrow same-origin route", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id, sourceExcluded: true }), { status: 200 }),
      );

    await expect(setContextSourceExclusion(id, true)).resolves.toEqual({
      id,
      sourceExcluded: true,
    });
    expect(request).toHaveBeenCalledWith(
      `/api/workspace/connected-work/items/${id}/source-exclusion`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ excluded: true }),
      }),
    );
  });
});
