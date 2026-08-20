"use client";

import { useEffect, useRef, useState } from "react";

type Scope = Readonly<{
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
}>;
type VoiceSource = Readonly<{
  kind: "voice_transcript";
  transcript: string;
  voiceSessionId: string;
}>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type VoiceRecording = Readonly<{
  stop: () => Promise<File>;
  cancel: () => void;
}>;

/** Browser-only adapter, kept injectable so recording state can be tested without device access. */
export type VoiceCaptureAdapter = Readonly<{
  start: () => Promise<VoiceRecording>;
}>;

type AudioStream = Readonly<{ getTracks: () => readonly Readonly<{ stop: () => void }>[] }>;
type BrowserRecorder = Readonly<{
  state: string;
  start: () => void;
  stop: () => void;
  addEventListener: (
    name: string,
    listener: (event: Event & { data?: Blob }) => void,
    options?: AddEventListenerOptions,
  ) => void;
}>;

type VoiceSession = Readonly<{
  sessionId: string;
  state: "transcribing" | "transcript_ready" | "transcript_confirmed" | "cancelled" | "failed";
  transcript: string | null;
  revision: number | null;
  transcriptConfirmed: boolean;
}>;

const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
]);
type VoiceStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "uploading"
  | "transcribing"
  | "ready"
  | "cancelled"
  | "error";
type StartVoiceRequest = Scope &
  Readonly<{
    idempotencyKey: string;
    uploadedSourceId: string;
    declaredDurationSeconds: number;
  }>;

export function canCancelVoice(status: VoiceStatus): boolean {
  return ["requesting", "recording", "uploading", "transcribing"].includes(status);
}

export function canRetryVoice(status: VoiceStatus, hasRetryRequest: boolean): boolean {
  return status === "error" && hasRetryRequest;
}

export function VoiceCapture({
  catalog,
  scope,
  onConfirmed,
  adapter = browserVoiceCaptureAdapter,
  fetcher = fetch,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  scope: Scope;
  onConfirmed?: (source: VoiceSource) => void;
  adapter?: VoiceCaptureAdapter;
  fetcher?: Fetcher;
}>) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const recording = useRef<VoiceRecording | null>(null);
  const retryRequest = useRef<StartVoiceRequest | null>(null);
  const activeIdempotencyKey = useRef<string | null>(null);
  const cancelRequested = useRef(false);
  useEffect(() => {
    if (status !== "recording") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [status]);

  async function startRecording() {
    cancelRequested.current = false;
    retryRequest.current = null;
    activeIdempotencyKey.current = null;
    setSession(null);
    setPermissionDenied(false);
    setStatus("requesting");
    try {
      const nextRecording = await adapter.start();
      if (cancelRequested.current) {
        nextRecording.cancel();
        setStatus("cancelled");
        return;
      }
      recording.current = nextRecording;
      setElapsed(0);
      setStatus("recording");
    } catch {
      recording.current = null;
      setPermissionDenied(true);
      setStatus("error");
    }
  }

  async function stopRecording() {
    const active = recording.current;
    if (active === null) return;
    recording.current = null;
    setStatus("uploading");
    try {
      await uploadAndTranscribe(await active.stop());
    } catch {
      setStatus("error");
    }
  }

  async function cancelRecording() {
    cancelRequested.current = true;
    recording.current?.cancel();
    recording.current = null;
    if (session !== null) {
      try {
        await postVoice(fetcher, `/api/daily-work/voice-updates/${session.sessionId}/cancel`, {});
      } catch {
        setStatus("error");
        return;
      }
    } else if (activeIdempotencyKey.current !== null) {
      try {
        await postVoice(
          fetcher,
          `/api/daily-work/voice-updates/idempotency/${activeIdempotencyKey.current}/cancel`,
          {},
        );
      } catch {
        // The upload may still be finishing before a server session exists. The local cancellation gate prevents submission.
      }
    }
    setStatus("cancelled");
  }

  async function uploadAndTranscribe(file: File) {
    if (!ACCEPTED_AUDIO_TYPES.has(file.type)) throw new Error("unsupported-audio");
    const uploadedSourceId = await uploadVoiceFile(file, scope, fetcher);
    if (cancelRequested.current) return;
    const request: StartVoiceRequest = {
      idempotencyKey: crypto.randomUUID(),
      uploadedSourceId,
      ...scope,
      declaredDurationSeconds: await declaredDurationSeconds(file),
    };
    retryRequest.current = request;
    activeIdempotencyKey.current = request.idempotencyKey;
    setStatus("transcribing");
    const next = await postVoice<VoiceSession>(fetcher, "/api/daily-work/voice-updates", request);
    if (cancelRequested.current || next.state === "cancelled") {
      const cancelled =
        next.state === "cancelled"
          ? next
          : await postVoice<VoiceSession>(
              fetcher,
              `/api/daily-work/voice-updates/${next.sessionId}/cancel`,
              {},
            );
      setSession(cancelled);
      setStatus("cancelled");
      return;
    }
    if (next.state === "failed") {
      setSession(next);
      throw new Error("transcription-failed");
    }
    applyReadySession(next);
  }

  function applyReadySession(next: VoiceSession) {
    if (next.transcript === null || next.revision === null || next.state !== "transcript_ready") {
      throw new Error("transcription-unavailable");
    }
    setSession(next);
    setTranscript(next.transcript);
    setStatus("ready");
  }

  async function retryTranscription() {
    const request = retryRequest.current;
    if (request === null) return;
    cancelRequested.current = false;
    setPermissionDenied(false);
    setStatus("transcribing");
    try {
      const next =
        session?.state === "failed"
          ? await postVoice<VoiceSession>(
              fetcher,
              `/api/daily-work/voice-updates/${session.sessionId}/retry`,
              {},
            )
          : await postVoice<VoiceSession>(fetcher, "/api/daily-work/voice-updates", request);
      if (next.state === "cancelled") {
        setSession(next);
        setStatus("cancelled");
        return;
      }
      applyReadySession(next);
    } catch {
      setStatus("error");
    }
  }

  async function confirmTranscript() {
    if (session === null || session.revision === null || transcript.trim() === "") return;
    setStatus("uploading");
    try {
      const revised =
        transcript === session.transcript
          ? session
          : await postVoice<VoiceSession>(
              fetcher,
              `/api/daily-work/voice-updates/${session.sessionId}/revisions`,
              { expectedRevision: session.revision, transcript },
            );
      if (revised.revision === null) throw new Error("transcript-revision-missing");
      const confirmed = await postVoice<VoiceSession>(
        fetcher,
        `/api/daily-work/voice-updates/${session.sessionId}/confirm`,
        {
          expectedRevision: revised.revision,
          reason:
            "Employee reviewed and confirmed the voice transcript before using it in an Update",
        },
      );
      if (!confirmed.transcriptConfirmed) throw new Error("transcript-not-confirmed");
      setSession(confirmed);
      setStatus("ready");
      onConfirmed?.({
        kind: "voice_transcript",
        transcript: confirmed.transcript ?? transcript,
        voiceSessionId: confirmed.sessionId,
      });
    } catch {
      setStatus("error");
    }
  }

  return (
    <section aria-label={catalog["voice.title"]} className="voiceCapture">
      <h3>{catalog["voice.title"]}</h3>
      <div className="formActions">
        <button disabled={canCancelVoice(status)} onClick={startRecording} type="button">
          {catalog["voice.start"]}
        </button>
        <button disabled={status !== "recording"} onClick={stopRecording} type="button">
          {catalog["voice.stop"]}
        </button>
        <button disabled={!canCancelVoice(status)} onClick={cancelRecording} type="button">
          {catalog["voice.cancel"]}
        </button>
      </div>
      <label>
        <span>{catalog["voice.upload"]}</span>
        <input
          accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
          disabled={canCancelVoice(status)}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (file === undefined) return;
            cancelRequested.current = false;
            retryRequest.current = null;
            activeIdempotencyKey.current = null;
            setSession(null);
            setPermissionDenied(false);
            setStatus("uploading");
            try {
              await uploadAndTranscribe(file);
            } catch {
              setStatus("error");
            } finally {
              input.value = "";
            }
          }}
          type="file"
        />
      </label>
      {status === "recording" ? (
        <p>
          {catalog["voice.recording"]}: {elapsed}s
        </p>
      ) : null}
      {status === "requesting" ? <p>{catalog["voice.requestingPermission"]}</p> : null}
      {status === "uploading" ? <p>{catalog["voice.uploading"]}</p> : null}
      {status === "transcribing" ? <p>{catalog["voice.transcribing"]}</p> : null}
      {status === "cancelled" ? <p>{catalog["voice.cancelled"]}</p> : null}
      {status === "error" ? (
        <p className="formError" role="alert">
          {catalog[permissionDenied ? "voice.permissionDenied" : "voice.retry"]}
        </p>
      ) : null}
      {canRetryVoice(status, retryRequest.current !== null) ? (
        <button onClick={retryTranscription} type="button">
          {catalog["voice.retry"]}
        </button>
      ) : null}
      <label>
        <span>{catalog["voice.transcript"]}</span>
        <textarea
          disabled={session === null || session.transcriptConfirmed}
          dir="auto"
          onChange={(event) => setTranscript(event.currentTarget.value)}
          rows={5}
          value={transcript}
        />
      </label>
      <button
        disabled={
          session === null ||
          status !== "ready" ||
          session.transcriptConfirmed ||
          transcript.trim() === ""
        }
        onClick={confirmTranscript}
        type="button"
      >
        {catalog["voice.confirmTranscript"]}
      </button>
      {session?.transcriptConfirmed ? <p>{catalog["voice.ready"]}</p> : null}
    </section>
  );
}

export const browserVoiceCaptureAdapter: VoiceCaptureAdapter = {
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("recording-unavailable");
    }
    return startBrowserVoiceRecording(
      () => navigator.mediaDevices.getUserMedia({ audio: true }),
      (stream, mimeType) => new MediaRecorder(stream as MediaStream, { mimeType }),
      MediaRecorder.isTypeSupported("audio/mp4"),
    );
  },
};

export async function startBrowserVoiceRecording(
  requestStream: () => Promise<AudioStream>,
  createRecorder: (stream: AudioStream, mimeType: string) => BrowserRecorder,
  supportsMp4: boolean,
): Promise<VoiceRecording> {
  const stream = await requestStream();
  const mimeType = supportsMp4 ? "audio/mp4" : "";
  if (mimeType === "") {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("recording-format-unsupported");
  }
  const recorder = createRecorder(stream, mimeType);
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data !== undefined && event.data.size > 0) chunks.push(event.data);
  });
  const completed = new Promise<File>((resolve, reject) => {
    recorder.addEventListener("error", () => reject(new Error("recording-failed")), { once: true });
    recorder.addEventListener(
      "stop",
      () => {
        stream.getTracks().forEach((track) => track.stop());
        resolve(new File(chunks, `voice-update-${Date.now()}.m4a`, { type: mimeType }));
      },
      { once: true },
    );
  });
  recorder.start();
  return {
    stop: async () => {
      if (recorder.state !== "inactive") recorder.stop();
      return completed;
    },
    cancel: () => {
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}

async function uploadVoiceFile(file: File, scope: Scope, fetcher: Fetcher): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  body.set(
    "metadata",
    JSON.stringify({
      projectId: scope.projectId,
      workstreamId: scope.workstreamId,
      reason: "Employee attached voice source for transcript review",
    }),
  );
  const response = await fetcher("/api/daily-work/evidence/uploads", { method: "POST", body });
  if (!response.ok) throw new Error("voice-upload-failed");
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { id?: unknown }).id !== "string"
  )
    throw new Error("voice-upload-response");
  return (value as { id: string }).id;
}

async function postVoice<T>(fetcher: Fetcher, path: string, body: unknown): Promise<T> {
  const response = await fetcher(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("voice-request-failed");
  return response.json() as Promise<T>;
}

async function declaredDurationSeconds(file: File): Promise<number> {
  if (typeof Audio === "undefined") return 1;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(normalizeDuration(audio.duration));
      audio.onerror = () => resolve(1);
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function normalizeDuration(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (value > 14_400) throw new Error("voice-duration-too-long");
  return Math.max(1, Math.ceil(value));
}
