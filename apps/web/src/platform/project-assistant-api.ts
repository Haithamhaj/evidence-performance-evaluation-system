import {
  AskProjectAssistantInputSchema,
  WebProjectAssistantAnswerSchema,
} from "./project-assistant-contracts";

export async function askProject(input: unknown) {
  const response = await fetch("/api/daily-work/experience/project-assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(AskProjectAssistantInputSchema.parse(input)),
  });
  if (!response.ok) throw new Error(`Project assistant request failed (${response.status})`);
  return WebProjectAssistantAnswerSchema.parse(await response.json());
}
