import { describe, expect, it, vi } from "vitest";

import { AuthoritativeExperienceRecipientAuthorizer } from "./experience-recipient-authorizer.js";

const recipientId = "50000000-0000-4000-8000-000000000001";
const entityId = "50000000-0000-4000-8000-000000000002";

describe("AuthoritativeExperienceRecipientAuthorizer", () => {
  it("authorizes a private Inbox signal only for its active owner", async () => {
    const findFirst = vi.fn(async ({ where }) =>
      where.employeeId === recipientId ? { id: entityId } : null,
    );
    const authorizer = new AuthoritativeExperienceRecipientAuthorizer({
      privateInboxItem: { findFirst },
    } as never);
    const refs = [{ entityType: "private_inbox_item", entityId, version: 1 }] as const;

    await expect(
      authorizer.authorize({ recipientId, entityRefs: refs, originatingDomain: "work_items" }),
    ).resolves.toBe(true);
    await expect(
      authorizer.authorize({
        recipientId: "50000000-0000-4000-8000-000000000003",
        entityRefs: refs,
        originatingDomain: "work_items",
      }),
    ).resolves.toBe(false);
  });

  it("fails closed for unsupported entity/domain combinations", async () => {
    const authorizer = new AuthoritativeExperienceRecipientAuthorizer({} as never);
    await expect(
      authorizer.authorize({
        recipientId,
        entityRefs: [{ entityType: "private_inbox_item", entityId, version: 1 }],
        originatingDomain: "evaluation",
      }),
    ).resolves.toBe(false);
  });
});
