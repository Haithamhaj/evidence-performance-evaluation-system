import { describe, expect, it, vi } from "vitest";

import { WorkItemsExperienceRecipientAuthorizer } from "./experience-recipient-authorizer.js";

const recipientId = "50000000-0000-4000-8000-000000000001";
const unrelatedId = "50000000-0000-4000-8000-000000000003";
const entityId = "50000000-0000-4000-8000-000000000002";

function authorizer(active = true) {
  return new WorkItemsExperienceRecipientAuthorizer({
    user: {
      findUnique: vi.fn(async ({ where }) => (where.id === recipientId ? { active } : null)),
    },
    privateInboxItem: {
      findFirst: vi.fn(async ({ where }) =>
        where.employeeId === recipientId ? { id: entityId } : null,
      ),
    },
    workItem: {
      findFirst: vi.fn(async ({ where }) =>
        where.OR.some((clause: Record<string, any>) =>
          [clause.assigneeId, clause.createdById, clause.participants?.some.employeeId].includes(
            recipientId,
          ),
        )
          ? { id: entityId }
          : null,
      ),
    },
  } as never);
}

describe("WorkItemsExperienceRecipientAuthorizer", () => {
  it.each(["private_inbox_item", "work_item"] as const)(
    "allows an active owner or participant and excludes an unrelated user for %s",
    async (entityType) => {
      const refs = [{ entityType, entityId, version: 1 }] as const;
      await expect(
        authorizer().authorize({ recipientId, entityRefs: refs, originatingDomain: "work_items" }),
      ).resolves.toBe(true);
      await expect(
        authorizer().authorize({
          recipientId: unrelatedId,
          entityRefs: refs,
          originatingDomain: "work_items",
        }),
      ).resolves.toBe(false);
    },
  );

  it("denies an inactive owner before reading Work Items domain records", async () => {
    const service = authorizer(false);
    await expect(
      service.authorize({
        recipientId,
        entityRefs: [{ entityType: "private_inbox_item", entityId, version: 1 }],
        originatingDomain: "work_items",
      }),
    ).resolves.toBe(false);
  });
});
