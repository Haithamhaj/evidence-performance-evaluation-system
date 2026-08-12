import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("../../../server/experience-stream/open-experience-stream.js", () => ({
  ExperienceStreamProxyError: class ExperienceStreamProxyError extends Error {},
  openExperienceStream: mocks.open,
}));

import { GET } from "./route.js";

afterEach(() => vi.clearAllMocks());

describe("experience stream same-origin proxy", () => {
  it("forwards the bounded replay cursor and returns an unbuffered event stream", async () => {
    mocks.open.mockResolvedValue(
      new Response('id: 8\nevent: experience.changed\ndata: {"cursor":"8"}\n\n', {
        headers: { "content-type": "text/event-stream" },
      }),
    );
    const request = new Request("http://localhost:3000/api/experience-stream?afterCursor=7", {
      headers: { "last-event-id": "7" },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(mocks.open).toHaveBeenCalledWith({
      afterCursor: "7",
      lastEventId: "7",
      signal: request.signal,
    });
  });

  it("rejects unknown query input before opening a protected stream", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/experience-stream?recipientId=other-user"),
    );

    expect(response.status).toBe(404);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
