import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { PrivateInboxService } from "./inbox-service.js";

const actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  active: true,
  roles: ["employee"],
} as const;
const uploadId = "00000000-0000-4000-8000-000000000002";

describe("Private Inbox Documents ownership boundary", () => {
  it.each(["wrong owner", "missing upload"])(
    "denies a file capture when Documents reports %s",
    async () => {
      const client = { $transaction: vi.fn() };
      const validator = {
        assertOwned: vi.fn(async () => {
          throw new AppError(
            "PRIVATE_CAPTURE_FORBIDDEN",
            "errors.privateCapture.forbidden",
            403,
          );
        }),
      };
      const service = new PrivateInboxService(
        client as never,
        { append: vi.fn() } as never,
        validator,
      );

      await expect(
        service.capture({
          actor,
          correlationId: "00000000-0000-4000-8000-000000000003",
          input: {
            text: "notes.pdf",
            projectId: null,
            sourceType: "file",
            sourceUploadId: uploadId,
          },
        }),
      ).rejects.toMatchObject({ code: "PRIVATE_CAPTURE_FORBIDDEN" });

      expect(validator.assertOwned).toHaveBeenCalledWith({
        actor,
        privateCaptureUploadId: uploadId,
      });
      expect(client.$transaction).not.toHaveBeenCalled();
    },
  );
});
