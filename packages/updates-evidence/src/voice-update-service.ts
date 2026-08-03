import {
  AppError,
  ConfirmVoiceTranscriptInputSchema,
  ReviseVoiceTranscriptInputSchema,
  StartVoiceUpdateInputSchema,
} from "@evaluation/contracts";
import { z } from "zod";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type UpdateScopeReader = import("./update-service.js").UpdateScopeReader;
type VoiceTranscriber = import("./voice-transcriber.js").VoiceTranscriber;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const StartCommandSchema = z.object({ actor: ActorSchema, correlationId: z.string().uuid(), input: StartVoiceUpdateInputSchema }).strict();
const RevisionCommandSchema = z.object({ actor: ActorSchema, voiceSessionId: z.string().uuid(), input: ReviseVoiceTranscriptInputSchema }).strict();
const ConfirmCommandSchema = z.object({ actor: ActorSchema, voiceSessionId: z.string().uuid(), input: ConfirmVoiceTranscriptInputSchema }).strict();
const MAX_VOICE_AUDIO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_AUDIO_MIME_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/x-m4a"]);

export interface VoiceTemporaryArtifactCleaner { cleanup(input: Readonly<{ voiceSessionId: string; outcome: "success" | "cancelled" | "failed" }>): Promise<void>; }

export class VoiceUpdateService {
  private readonly client: DatabaseClient;
  private readonly scopeReader: UpdateScopeReader;
  private readonly transcriber: VoiceTranscriber;
  private readonly cleaner: VoiceTemporaryArtifactCleaner;
  private readonly clock: () => Date;
  constructor(
    client: DatabaseClient,
    scopeReader: UpdateScopeReader,
    transcriber: VoiceTranscriber,
    cleaner: VoiceTemporaryArtifactCleaner = { cleanup: async () => undefined },
    clock: () => Date = () => new Date(),
  ) { this.client = client; this.scopeReader = scopeReader; this.transcriber = transcriber; this.cleaner = cleaner; this.clock = clock; }

  async start(command: unknown) {
    const parsed = StartCommandSchema.parse(command);
    if (!parsed.actor.active) throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
    const at = this.clock();
    const prepared = await this.client.$transaction(async (transaction) => {
      const scope = await this.scopeReader.authorizeIn(transaction, { ...parsed.input, actor: parsed.actor, at });
      const existing = await transaction.voiceUpdateSession.findUnique({
        where: { idempotencyKey: parsed.input.idempotencyKey },
        include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true },
      });
      if (existing !== null) {
        if (
          existing.employeeId !== parsed.actor.userId ||
          existing.uploadedSourceId !== parsed.input.uploadedSourceId ||
          existing.projectId !== parsed.input.projectId ||
          existing.workstreamId !== parsed.input.workstreamId ||
          existing.workItemId !== parsed.input.workItemId ||
          existing.declaredDurationSeconds !== parsed.input.declaredDurationSeconds
        ) {
          throw new AppError("VOICE_IDEMPOTENCY_CONFLICT", "errors.voice.idempotencyConflict", 409);
        }
        return { existing, scope: null, upload: null };
      }
      const upload = await transaction.uploadedSource.findFirst({ where: { id: parsed.input.uploadedSourceId, createdById: parsed.actor.userId, projectId: parsed.input.projectId, workstreamId: parsed.input.workstreamId }, select: { id: true, detectedMime: true, byteSize: true } });
      if (
        upload === null ||
        !ACCEPTED_AUDIO_MIME_TYPES.has(upload.detectedMime) ||
        upload.byteSize < 1 ||
        upload.byteSize > MAX_VOICE_AUDIO_BYTES
      ) {
        throw new AppError("VOICE_AUDIO_INVALID", "errors.voice.audioInvalid", 422);
      }
      const created = await transaction.voiceUpdateSession.create({ data: { idempotencyKey: parsed.input.idempotencyKey, projectId: parsed.input.projectId, workstreamId: parsed.input.workstreamId, workItemId: parsed.input.workItemId, employeeId: parsed.actor.userId, uploadedSourceId: upload.id, state: "transcribing", declaredDurationSeconds: parsed.input.declaredDurationSeconds, retentionPolicyKey: "organization_private_upload_policy", retentionMetadata: { governedPrivateUpload: true, temporaryArtifacts: "delete_on_terminal_state" } } });
      return { existing: created, scope, upload };
    });
    if (prepared.scope === null) return serialize(prepared.existing);
    let session: Awaited<ReturnType<DatabaseClient["voiceUpdateSession"]["update"]>>;
    try {
      const upload = prepared.upload;
      if (upload === null) throw new AppError("VOICE_AUDIO_INVALID", "errors.voice.audioInvalid", 422);
      const output = await this.transcriber.transcribe({ voiceSessionId: prepared.existing.id, uploadedSourceId: prepared.existing.uploadedSourceId, projectScopeId: prepared.scope.projectScopeId, departmentScopeId: prepared.scope.departmentScopeId, correlationId: parsed.correlationId, mediaType: upload.detectedMime, byteSize: upload.byteSize, declaredDurationSeconds: prepared.existing.declaredDurationSeconds });
      session = await this.client.$transaction((transaction) => transaction.voiceUpdateSession.update({ where: { id: prepared.existing.id }, data: { state: "transcript_ready", language: output.language, dialect: output.dialect, ...(output.aiRunId === null ? {} : { aiRunId: output.aiRunId }), transcriptRevisions: { create: { revision: 1, origin: "ai", transcript: output.transcript, language: output.language, dialect: output.dialect, ...(output.aiRunId === null ? {} : { aiRunId: output.aiRunId }) } } }, include: { transcriptRevisions: true, confirmation: true } }));
    } catch (error) {
      await this.client.voiceUpdateSession.update({ where: { id: prepared.existing.id }, data: { state: "failed", temporaryArtifactsCleanedAt: this.clock() } });
      await this.cleaner.cleanup({ voiceSessionId: prepared.existing.id, outcome: "failed" });
      throw error;
    }
    await this.cleaner.cleanup({ voiceSessionId: session.id, outcome: "success" });
    const cleaned = await this.client.voiceUpdateSession.update({ where: { id: session.id }, data: { temporaryArtifactsCleanedAt: this.clock() }, include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true } });
    return serialize(cleaned);
  }

  async reviseTranscript(command: unknown) {
    const parsed = RevisionCommandSchema.parse(command);
    return this.client.$transaction(async (transaction) => {
      const session = await ownedSession(transaction, parsed.actor, parsed.voiceSessionId);
      const latest = session.transcriptRevisions[0];
      if (session.state !== "transcript_ready" || latest === undefined || latest.revision !== parsed.input.expectedRevision) throw new AppError("VOICE_TRANSCRIPT_VERSION_CONFLICT", "errors.voice.transcriptVersionConflict", 409);
      const revised = await transaction.voiceUpdateSession.update({ where: { id: session.id }, data: { transcriptRevisions: { create: { revision: latest.revision + 1, origin: "employee", transcript: parsed.input.transcript, language: latest.language, dialect: latest.dialect } } }, include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true } });
      return serialize(revised);
    });
  }

  async confirmTranscript(command: unknown) {
    const parsed = ConfirmCommandSchema.parse(command);
    return this.client.$transaction(async (transaction) => {
      const session = await ownedSession(transaction, parsed.actor, parsed.voiceSessionId);
      const latest = session.transcriptRevisions[0];
      if (session.state !== "transcript_ready" || latest === undefined || latest.revision !== parsed.input.expectedRevision) throw new AppError("VOICE_TRANSCRIPT_CONFIRMATION_REQUIRED", "errors.voice.transcriptConfirmationRequired", 409);
      const confirmed = await transaction.voiceUpdateSession.update({ where: { id: session.id }, data: { state: "transcript_confirmed", confirmation: { create: { transcriptRevisionId: latest.id, employeeId: parsed.actor.userId, reason: parsed.input.reason, confirmedAt: this.clock() } } }, include: { transcriptRevisions: true, confirmation: true } });
      return serialize(confirmed);
    });
  }
}

async function ownedSession(transaction: Transaction, actor: { userId: string; active: boolean }, id: string) {
  const session = await transaction.voiceUpdateSession.findUnique({ where: { id }, include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true } });
  if (!actor.active || session === null || session.employeeId !== actor.userId) throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
  return session;
}
function serialize(session: { id: string; state: string; language: string | null; dialect: string | null; transcriptRevisions: Array<{ revision: number; transcript: string }>; confirmation?: unknown | null }) { const latest = session.transcriptRevisions[0]; return { sessionId: session.id, state: session.state, transcript: latest?.transcript ?? null, revision: latest?.revision ?? null, language: session.language, dialect: session.dialect, transcriptConfirmed: session.confirmation !== null && session.confirmation !== undefined }; }
