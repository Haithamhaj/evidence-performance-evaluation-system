import {
  CaptureUnderstandingInputSchema,
  WebCaptureUnderstandingSchema,
} from "./capture-understanding-contracts";

export async function understandCapture(
  input: import("./capture-understanding-contracts").CaptureUnderstandingInput,
): Promise<import("./capture-understanding-contracts").WebCaptureUnderstanding> {
  const response = await fetch("/api/daily-work/experience/capture-understand", {
    body: JSON.stringify(CaptureUnderstandingInputSchema.parse(input)),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("CAPTURE_UNDERSTANDING_REQUEST_FAILED");
  return WebCaptureUnderstandingSchema.parse(await response.json());
}
