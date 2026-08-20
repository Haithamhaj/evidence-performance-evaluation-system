export type StagedCaptureUpdateSource = Readonly<{
  kind: "image" | "file";
  uploadedSourceId: string;
}>;

type CaptureScope = Readonly<{ projectId: string; workstreamId: string | null }>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function stageCaptureUpdateFile(
  file: File,
  scope: CaptureScope,
  fetcher: Fetcher = fetch,
): Promise<StagedCaptureUpdateSource> {
  const body = new FormData();
  body.set("file", file);
  body.set(
    "metadata",
    JSON.stringify({
      projectId: scope.projectId,
      workstreamId: scope.workstreamId,
      reason: "Employee attached a source to an Update",
    }),
  );
  const response = await fetcher("/api/daily-work/evidence/uploads", { method: "POST", body });
  if (!response.ok) throw new Error("CAPTURE_UPDATE_UPLOAD_FAILED");
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { id?: unknown }).id !== "string"
  ) {
    throw new Error("CAPTURE_UPDATE_UPLOAD_FAILED");
  }
  return {
    kind: file.type.startsWith("image/") ? "image" : "file",
    uploadedSourceId: (value as { id: string }).id,
  };
}
