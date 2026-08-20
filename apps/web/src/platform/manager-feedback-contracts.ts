import { z } from "zod";

const Uuid = z.string().uuid();
const Instant = z.iso.datetime({ offset: true });
const Rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const CriterionResponse = z
  .object({ criterionId: Uuid, rating: Rating, comment: z.string().max(8_000) })
  .strict();

export const WebManagerCriterionResponsesSchema = z
  .array(CriterionResponse)
  .length(5)
  .superRefine((responses, context) => {
    if (new Set(responses.map(({ criterionId }) => criterionId)).size !== responses.length) {
      context.addIssue({ code: "custom", message: "Responses must use five unique criteria." });
    }
  });

export const WebSubmitManagerEvaluationReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    responseId: Uuid,
    cycleId: Uuid,
    evaluatorId: Uuid,
    state: z.literal("SUBMITTED"),
    submittedAt: Instant,
  })
  .strict();

const IdentifiedResponse = z
  .object({
    schemaVersion: z.literal(1),
    responseId: Uuid,
    cycleId: Uuid,
    managerId: Uuid,
    submitterId: Uuid,
    submitterDisplayName: z.string().trim().min(1).max(500),
    visibilityMode: z.literal("IDENTIFIED"),
    state: z.literal("SUBMITTED"),
    responses: WebManagerCriterionResponsesSchema,
    submittedAt: Instant,
  })
  .strict();

export const WebManagerEvaluationParticipantJourneySchema = z
  .object({
    schemaVersion: z.literal(1),
    cycle: z
      .object({
        id: Uuid,
        state: z.enum(["OPEN", "CLOSED", "CANCELLED"]),
        visibilityMode: z.literal("IDENTIFIED"),
        startsAt: Instant,
        endsAt: Instant,
      })
      .strict(),
    manager: z.object({ id: Uuid, displayName: z.string().trim().min(1).max(500) }).strict(),
    eligibility: z
      .object({
        id: Uuid,
        state: z.enum(["ELIGIBLE_PENDING", "SUBMITTED", "APPROVED_LEAVE", "POSTPONED", "EXCLUDED"]),
        version: z.number().int().positive(),
      })
      .strict(),
    criteria: z
      .array(
        z
          .object({
            criterionId: Uuid,
            stableCriterionId: z.enum(["MGR-01", "MGR-02", "MGR-03", "MGR-04", "MGR-05"]),
            commentRequired: z.boolean(),
            anchors: z
              .array(
                z.object({ rating: Rating, text: z.string().trim().min(1).max(8_000) }).strict(),
              )
              .length(5),
          })
          .strict(),
      )
      .length(5),
    submittedResponse: IdentifiedResponse.nullable(),
  })
  .strict();
