/* eslint-disable no-unused-vars */
import {
  type WebPreparedExperienceComposition,
  WebPreparedExperienceCompositionSchema,
} from "./experience-orchestration-contracts";

export async function loadPreparedExperience(): Promise<WebPreparedExperienceComposition> {
  const response = await fetch("/api/daily-work/experience/prepared", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("EXPERIENCE_PREPARED_REQUEST_FAILED");
  return WebPreparedExperienceCompositionSchema.parse(await response.json());
}
