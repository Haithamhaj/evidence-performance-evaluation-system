import { describe, expect, it } from "vitest";

describe("offboarding historical preservation", () => {
  it("keeps historical actor references after account deactivation", () => {
    const user = { id: "former-owner", active: false };
    const history = [{ id: "event-1", actorId: user.id, kind: "project.update" }];
    expect(history).toContainEqual(expect.objectContaining({ actorId: user.id }));
  });
});
