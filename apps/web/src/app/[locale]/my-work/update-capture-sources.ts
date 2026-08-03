export type UpdateCaptureSource =
  | Readonly<{ kind: "image" | "file"; uploadedSourceId: string }>
  | Readonly<{ kind: "pasted_code" | "cli_snapshot" | "github_snapshot"; text: string }>
  | Readonly<{ kind: "url"; url: string }>;
export type RecoverableCaptureSource = Readonly<{
  kind: string;
  uploadedSourceId?: string;
  url?: string;
}>;

type CaptureScope = Readonly<{ projectId: string; workstreamId: string | null }>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function uploadUpdateFile(
  file: File,
  scope: CaptureScope,
  fetcher: Fetcher = fetch,
): Promise<Extract<UpdateCaptureSource, { uploadedSourceId: string }>> {
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
  if (!response.ok) throw new Error("upload");
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null || typeof (value as { id?: unknown }).id !== "string") {
    throw new Error("upload-response");
  }
  return {
    kind: file.type.startsWith("image/") ? "image" : "file",
    uploadedSourceId: (value as { id: string }).id,
  };
}

export async function collectCaptureSources(
  form: FormData,
  scope: CaptureScope,
  upload: (file: File, scope: CaptureScope) => Promise<Extract<UpdateCaptureSource, { uploadedSourceId: string }>> =
    uploadUpdateFile,
): Promise<readonly UpdateCaptureSource[]> {
  const files = form
    .getAll("sourceFiles")
    .filter((value): value is File => value instanceof File && value.name !== "" && value.size > 0);
  const uploaded = await Promise.all(files.map((file) => upload(file, scope)));
  return [
    ...uploaded,
    ...textSource(form, "sourceCode", "pasted_code"),
    ...textSource(form, "sourceCli", "cli_snapshot"),
    ...urlSource(form),
    ...textSource(form, "sourceGithub", "github_snapshot"),
  ];
}

export function recoverableCaptureSources(form: FormData): readonly RecoverableCaptureSource[] {
  return [
    ...sourceMetadata(form, "sourceCode", "pasted_code"),
    ...sourceMetadata(form, "sourceCli", "cli_snapshot"),
    ...urlMetadata(form),
    ...sourceMetadata(form, "sourceGithub", "github_snapshot"),
  ];
}

export function updateDraftText<
  T extends Readonly<{ rawText: string; sources: readonly RecoverableCaptureSource[] }>,
>(
  draft: T,
  rawText: string,
): T {
  return { ...draft, rawText, sources: [...draft.sources] };
}

function textSource(
  form: FormData,
  name: string,
  kind: "pasted_code" | "cli_snapshot" | "github_snapshot",
): readonly UpdateCaptureSource[] {
  const text = optionalText(form, name);
  return text === null ? [] : [{ kind, text }];
}

function urlSource(form: FormData): readonly UpdateCaptureSource[] {
  const url = optionalText(form, "sourceUrl");
  return url === null ? [] : [{ kind: "url", url }];
}

function sourceMetadata(
  form: FormData,
  name: string,
  kind: "pasted_code" | "cli_snapshot" | "github_snapshot",
): readonly RecoverableCaptureSource[] {
  return optionalText(form, name) === null ? [] : [{ kind }];
}

function urlMetadata(form: FormData): readonly RecoverableCaptureSource[] {
  const url = optionalText(form, "sourceUrl");
  return url === null ? [] : [{ kind: "url", url }];
}

function optionalText(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
