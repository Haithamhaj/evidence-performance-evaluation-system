export type UpdateCaptureSource =
  | Readonly<{ kind: "image" | "file"; uploadedSourceId: string }>
  | Readonly<{ kind: "voice_transcript"; voiceSessionId: string }>
  | Readonly<{ kind: "pasted_code" | "cli_snapshot" | "github_snapshot"; text: string }>
  | Readonly<{ kind: "url"; url: string }>;
export type RecoverableCaptureSource = Readonly<{
  kind: string;
  uploadedSourceId?: string;
  voiceSessionId?: string;
  url?: string;
}>;

type CaptureScope = Readonly<{ projectId: string; workstreamId: string | null }>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function uploadUpdateFile(
  file: File,
  scope: CaptureScope,
  fetcher: Fetcher = fetch,
): Promise<Extract<UpdateCaptureSource, { uploadedSourceId: string }>> {
  return stageCaptureUpdateFile(file, scope, fetcher);
}

export async function collectCaptureSources(
  form: FormData,
  scope: CaptureScope,
  upload: (
    file: File,
    scope: CaptureScope,
  ) => Promise<Extract<UpdateCaptureSource, { uploadedSourceId: string }>> = uploadUpdateFile,
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

export function mergeResumedCaptureSources(
  recovered: readonly RecoverableCaptureSource[],
  captured: readonly UpdateCaptureSource[],
): readonly UpdateCaptureSource[] {
  const merged = [...recovered.flatMap(recoveredSubmitSource), ...captured];
  const keys = new Set<string>();
  return merged.filter((source) => {
    const key = sourceKey(source);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export function updateDraftText<
  T extends Readonly<{ rawText: string; sources: readonly RecoverableCaptureSource[] }>,
>(draft: T, rawText: string): T {
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

function recoveredSubmitSource(source: RecoverableCaptureSource): readonly UpdateCaptureSource[] {
  if (
    (source.kind === "image" || source.kind === "file") &&
    typeof source.uploadedSourceId === "string" &&
    source.uploadedSourceId !== ""
  ) {
    return [{ kind: source.kind, uploadedSourceId: source.uploadedSourceId }];
  }
  if (source.kind === "url" && typeof source.url === "string" && isSafeSourceUrl(source.url)) {
    return [{ kind: "url", url: source.url }];
  }
  if (source.kind === "voice_transcript" && typeof source.voiceSessionId === "string") {
    return [{ kind: "voice_transcript", voiceSessionId: source.voiceSessionId }];
  }
  return [];
}

function isSafeSourceUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function sourceKey(source: UpdateCaptureSource): string {
  if ("uploadedSourceId" in source) return `${source.kind}:${source.uploadedSourceId}`;
  if ("voiceSessionId" in source) return `${source.kind}:${source.voiceSessionId}`;
  if ("url" in source) return `${source.kind}:${source.url}`;
  return `${source.kind}:${source.text}`;
}
import { stageCaptureUpdateFile } from "../../../platform/capture-update-source-api";
