/* eslint-disable no-unused-vars */
import {
  type WebPreparedExperienceComposition,
  WebPreparedExperienceCompositionSchema,
  type WebSuggestionFeedbackInput,
  type WebSuggestionFeedbackReceipt,
  WebSuggestionFeedbackReceiptSchema,
} from "./experience-orchestration-contracts";

export async function loadPreparedExperience(): Promise<WebPreparedExperienceComposition> {
  const response = await fetch("/api/daily-work/experience/prepared", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("EXPERIENCE_PREPARED_REQUEST_FAILED");
  return WebPreparedExperienceCompositionSchema.parse(await response.json());
}

export async function recordPreparedExperienceFeedback(
  preparedItemId: string,
  input: WebSuggestionFeedbackInput,
): Promise<WebSuggestionFeedbackReceipt> {
  const response = await fetch(
    `/api/daily-work/experience/prepared/${encodeURIComponent(preparedItemId)}/feedback`,
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error("EXPERIENCE_FEEDBACK_REQUEST_FAILED");
  return WebSuggestionFeedbackReceiptSchema.parse(await response.json());
}
