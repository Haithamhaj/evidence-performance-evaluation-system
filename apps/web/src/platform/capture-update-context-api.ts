import { UpdateComposerContextSchema } from "./updates-evidence-contracts";

export async function loadCaptureUpdateContext() {
  const response = await fetch("/api/daily-work/update-context", { method: "GET" });
  if (!response.ok) throw new Error("CAPTURE_UPDATE_CONTEXT_UNAVAILABLE");
  return UpdateComposerContextSchema.parse(await response.json());
}
