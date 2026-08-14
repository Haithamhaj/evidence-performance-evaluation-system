"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fetchProtectedUpstream, safeWorkspaceError } from "../../../platform/workspace-api";

export type OwnershipTransferState =
  | { readonly status: "idle" }
  | { readonly status: "success" }
  | { readonly status: "stale"; readonly correlationId?: string }
  | { readonly status: "error"; readonly correlationId?: string };

const BaseSchema = z.object({
  locale: z.enum(["ar", "en"]),
  projectId: z.string().uuid(),
  toUserId: z.string().uuid(),
  effectiveAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(1).max(1_000),
  expectedVersion: z.coerce.number().int().positive(),
});
const TransferSchema = z.discriminatedUnion("transferKind", [
  BaseSchema.extend({ transferKind: z.literal("permanent") }).strict(),
  BaseSchema.extend({
    transferKind: z.literal("acting"),
    endsAt: z.iso.datetime({ offset: true }),
    delegationType: z.string().trim().min(1).max(80),
  })
    .strict()
    .superRefine((value, context) => {
      if (Date.parse(value.endsAt) <= Date.parse(value.effectiveAt)) {
        context.addIssue({ code: "custom", path: ["endsAt"], message: "acting period is invalid" });
      }
    }),
]);

export async function transferProjectOwnershipAction(
  _previous: OwnershipTransferState,
  formData: FormData,
): Promise<OwnershipTransferState> {
  const parsed = TransferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error" };
  const value = parsed.data;
  try {
    await fetchProtectedUpstream({
      path: `/api/v1/projects/${value.projectId}/owner-transfers`,
      method: "POST",
      body:
        value.transferKind === "acting"
          ? {
              transferKind: "acting",
              toUserId: value.toUserId,
              effectiveAt: value.effectiveAt,
              endsAt: value.endsAt,
              delegationType: value.delegationType,
              reason: value.reason,
              expectedVersion: value.expectedVersion,
            }
          : {
              transferKind: "permanent",
              toUserId: value.toUserId,
              effectiveAt: value.effectiveAt,
              reason: value.reason,
              expectedVersion: value.expectedVersion,
            },
      schema: { parse: () => undefined },
    });
    revalidatePath(`/${value.locale}/projects/${value.projectId}`);
    return { status: "success" };
  } catch (error) {
    const failure = safeWorkspaceError(error);
    return failure.status === 409
      ? { status: "stale", correlationId: failure.correlationId }
      : { status: "error", correlationId: failure.correlationId };
  }
}
