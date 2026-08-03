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
const SessionCommandSchema = z.object({ actor: ActorSchema, correlationId: z.string().uuid(), voiceSessionId: z.string().uuid() }).strict();
const IdempotencySessionCommandSchema = z.object({ actor: ActorSchema, correlationId: z.string().uuid(), idempotencyKey: z.string().uuid() }).strict();
const MAX_VOICE_AUDIO_BYTES = 10 * 1024 * 1024;
const TRANSCRIPTION_ATTEMPT_LEASE_MS = 90_000;
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
      const upload = await transaction.uploadedSource.findFirst({
        where: { id: parsed.input.uploadedSourceId, createdById: parsed.actor.userId },
        select: { id: true, detectedMime: true, byteSize: true, projectId: true, workstreamId: true, workstream: { select: { projectId: true } } },
      });
      if (
        upload === null ||
        (upload.projectId ?? upload.workstream?.projectId) !== parsed.input.projectId ||
        upload.workstreamId !== parsed.input.workstreamId ||
        !ACCEPTED_AUDIO_MIME_TYPES.has(upload.detectedMime) ||
        upload.byteSize < 1 ||
        upload.byteSize > MAX_VOICE_AUDIO_BYTES
      ) {
        throw new AppError("VOICE_AUDIO_INVALID", "errors.voice.audioInvalid", 422);
      }
      const created = await transaction.voiceUpdateSession.create({ data: { idempotencyKey: parsed.input.idempotencyKey, projectId: parsed.input.projectId, workstreamId: parsed.input.workstreamId, workItemId: parsed.input.workItemId, employeeId: parsed.actor.userId, uploadedSourceId: upload.id, state: "transcribing", declaredDurationSeconds: parsed.input.declaredDurationSeconds, retentionPolicyKey: "organization_private_upload_policy", retentionMetadata: { governedPrivateUpload: true, temporaryArtifacts: "delete_on_terminal_state" } } });
      return { existing: created, scope, upload };
    });
    if (prepared.scope === null || prepared.upload === null) {
      if (prepared.existing.state === "failed" || prepared.existing.state === "transcribing") {
        return this.retry({
          actor: parsed.actor,
          correlationId: parsed.correlationId,
          voiceSessionId: prepared.existing.id,
        });
      }
      return serialize(prepared.existing);
    }
    return this.transcribePrepared({
      correlationId: parsed.correlationId,
      sessionId: prepared.existing.id,
      attemptToken: prepared.existing.transcriptionAttemptToken,
      scope: prepared.scope,
      upload: prepared.upload,
    });
  }

  async retry(command: unknown) {
    const parsed = SessionCommandSchema.parse(command);
    const prepared = await this.client.$transaction(async (transaction) => {
      const session = await authorizedOwnedSession(
        transaction,
        this.scopeReader,
        parsed.actor,
        parsed.voiceSessionId,
        this.clock(),
      );
      if (["transcript_ready", "transcript_confirmed", "cancelled"].includes(session.state)) {
        return { session, scope: null, upload: null };
      }
      if (session.state !== "failed" && session.state !== "transcribing") {
        throw new AppError("VOICE_RETRY_INVALID", "errors.voice.retryInvalid", 409);
      }
      const now = this.clock();
      if (
        session.state === "transcribing" &&
        session.transcriptionAttemptStartedAt.getTime() > now.getTime() - TRANSCRIPTION_ATTEMPT_LEASE_MS
      ) {
        return { session, scope: null, upload: null };
      }
      const scope = await this.scopeReader.authorizeIn(transaction, {
        actor: parsed.actor,
        projectId: session.projectId,
        workstreamId: session.workstreamId,
        workItemId: session.workItemId,
        at: now,
      });
      const upload = await validatedSessionUpload(transaction, session);
      const retrying = await transaction.voiceUpdateSession.update({
            where: { id: session.id },
            data: {
              state: "transcribing",
              temporaryArtifactsCleanedAt: null,
              transcriptionAttemptToken: crypto.randomUUID(),
              transcriptionAttemptStartedAt: now,
            },
            include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true },
          });
      return { session: retrying, scope, upload };
    }, { isolationLevel: "Serializable" });
    if (prepared.scope === null || prepared.upload === null) return serialize(prepared.session);
    return this.transcribePrepared({
      correlationId: parsed.correlationId,
      sessionId: prepared.session.id,
      attemptToken: prepared.session.transcriptionAttemptToken,
      scope: prepared.scope,
      upload: prepared.upload,
    });
  }

  private async transcribePrepared(input: Readonly<{
    correlationId: string;
    sessionId: string;
    attemptToken: string;
    scope: Awaited<ReturnType<UpdateScopeReader["authorizeIn"]>>;
    upload: Readonly<{ id: string; detectedMime: string; byteSize: number }>;
  }>) {
    let session: Awaited<ReturnType<DatabaseClient["voiceUpdateSession"]["findUniqueOrThrow"]>> & {
      transcriptRevisions: Array<{ revision: number; transcript: string }>;
      confirmation: unknown | null;
    };
    try {
      const current = await this.client.voiceUpdateSession.findUniqueOrThrow({ where: { id: input.sessionId } });
      const output = await this.transcriber.transcribe({
        voiceSessionId: current.id,
        uploadedSourceId: current.uploadedSourceId,
        projectScopeId: input.scope.projectScopeId,
        departmentScopeId: input.scope.departmentScopeId,
        correlationId: input.correlationId,
        mediaType: input.upload.detectedMime,
        byteSize: input.upload.byteSize,
        declaredDurationSeconds: current.declaredDurationSeconds,
      });
      session = await this.client.$transaction(async (transaction) => {
        await lockSession(transaction, input.sessionId);
        const locked = await transaction.voiceUpdateSession.findUniqueOrThrow({
          where: { id: input.sessionId },
          include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true },
        });
        if (
          locked.state !== "transcribing" ||
          locked.transcriptionAttemptToken !== input.attemptToken ||
          locked.transcriptRevisions.length > 0
        ) return locked;
        return transaction.voiceUpdateSession.update({
          where: { id: locked.id },
          data: {
            state: "transcript_ready",
            language: output.language,
            dialect: output.dialect,
            ...(output.aiRunId === null ? {} : { aiRunId: output.aiRunId }),
            transcriptRevisions: {
              create: {
                revision: 1,
                origin: "ai",
                transcript: output.transcript,
                language: output.language,
                dialect: output.dialect,
                ...(output.aiRunId === null ? {} : { aiRunId: output.aiRunId }),
              },
            },
          },
          include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true },
        });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      const failed = await this.client.$transaction(async (transaction) => {
        await lockSession(transaction, input.sessionId);
        const current = await transaction.voiceUpdateSession.findUniqueOrThrow({
          where: { id: input.sessionId },
          include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true },
        });
        if (
          current.state !== "transcribing" ||
          current.transcriptionAttemptToken !== input.attemptToken
        ) return current;
        return transaction.voiceUpdateSession.update({
          where: { id: current.id },
          data: { state: "failed" },
          include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true },
        });
      }, { isolationLevel: "Serializable" });
      if (failed.state === "cancelled") return serialize(failed);
      if (failed.state === "failed" && failed.temporaryArtifactsCleanedAt === null) {
        await this.cleaner.cleanup({ voiceSessionId: failed.id, outcome: "failed" });
        await this.client.voiceUpdateSession.update({ where: { id: failed.id }, data: { temporaryArtifactsCleanedAt: this.clock() } });
      }
      throw error;
    }
    if (session.state !== "transcript_ready") return serialize(session);
    await this.cleaner.cleanup({ voiceSessionId: session.id, outcome: "success" });
    const cleaned = await this.client.voiceUpdateSession.update({ where: { id: session.id }, data: { temporaryArtifactsCleanedAt: this.clock() }, include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true } });
    return serialize(cleaned);
  }

  async reviseTranscript(command: unknown) {
    const parsed = RevisionCommandSchema.parse(command);
    return this.client.$transaction(async (transaction) => {
      const session = await authorizedOwnedSession(transaction, this.scopeReader, parsed.actor, parsed.voiceSessionId, this.clock());
      const latest = session.transcriptRevisions[0];
      if (session.state !== "transcript_ready" || latest === undefined || latest.revision !== parsed.input.expectedRevision) throw new AppError("VOICE_TRANSCRIPT_VERSION_CONFLICT", "errors.voice.transcriptVersionConflict", 409);
      const revised = await transaction.voiceUpdateSession.update({ where: { id: session.id }, data: { transcriptRevisions: { create: { revision: latest.revision + 1, origin: "employee", transcript: parsed.input.transcript, language: latest.language, dialect: latest.dialect } } }, include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true } });
      return serialize(revised);
    });
  }

  async confirmTranscript(command: unknown) {
    const parsed = ConfirmCommandSchema.parse(command);
    return this.client.$transaction(async (transaction) => {
      const session = await authorizedOwnedSession(transaction, this.scopeReader, parsed.actor, parsed.voiceSessionId, this.clock());
      const latest = session.transcriptRevisions[0];
      if (session.state !== "transcript_ready" || latest === undefined || latest.revision !== parsed.input.expectedRevision) throw new AppError("VOICE_TRANSCRIPT_CONFIRMATION_REQUIRED", "errors.voice.transcriptConfirmationRequired", 409);
      const confirmed = await transaction.voiceUpdateSession.update({ where: { id: session.id }, data: { state: "transcript_confirmed", confirmation: { create: { transcriptRevisionId: latest.id, employeeId: parsed.actor.userId, reason: parsed.input.reason, confirmedAt: this.clock() } } }, include: { transcriptRevisions: true, confirmation: true } });
      return serialize(confirmed);
    });
  }

  async cancel(command: unknown) {
    const parsed = SessionCommandSchema.parse(command);
    const session = await this.client.$transaction(async (transaction) => {
      const owned = await authorizedOwnedSession(transaction, this.scopeReader, parsed.actor, parsed.voiceSessionId, this.clock());
      if (owned.state === "transcript_confirmed") throw new AppError("VOICE_TRANSCRIPT_CONFIRMATION_REQUIRED", "errors.voice.transcriptConfirmationRequired", 409);
      if (owned.state === "cancelled") return owned;
      return transaction.voiceUpdateSession.update({ where: { id: owned.id }, data: { state: "cancelled" }, include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true } });
    });
    if (session.state === "cancelled" && session.temporaryArtifactsCleanedAt === null) {
      await this.cleaner.cleanup({ voiceSessionId: session.id, outcome: "cancelled" });
      return serialize(await this.client.voiceUpdateSession.update({ where: { id: session.id }, data: { temporaryArtifactsCleanedAt: this.clock() }, include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true } }));
    }
    return serialize(session);
  }

  async cancelByIdempotencyKey(command: unknown) {
    const parsed = IdempotencySessionCommandSchema.parse(command);
    const session = await this.client.voiceUpdateSession.findUnique({
      where: { idempotencyKey: parsed.idempotencyKey },
      select: { id: true, employeeId: true },
    });
    if (session === null || session.employeeId !== parsed.actor.userId) {
      throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
    }
    return this.cancel({
      actor: parsed.actor,
      correlationId: parsed.correlationId,
      voiceSessionId: session.id,
    });
  }
}

async function ownedSession(transaction: Transaction, actor: { userId: string; active: boolean }, id: string) {
  const session = await transaction.voiceUpdateSession.findUnique({ where: { id }, include: { transcriptRevisions: { orderBy: { revision: "desc" }, take: 1 }, confirmation: true } });
  if (!actor.active || session === null || session.employeeId !== actor.userId) throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
  return session;
}
async function authorizedOwnedSession(
  transaction: Transaction,
  scopeReader: UpdateScopeReader,
  actor: { userId: string; active: boolean },
  id: string,
  at: Date,
) {
  const candidate = await transaction.voiceUpdateSession.findUnique({
    where: { id },
    select: { id: true, employeeId: true, projectId: true, workstreamId: true, workItemId: true },
  });
  if (!actor.active || candidate === null || candidate.employeeId !== actor.userId) {
    throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
  }
  await scopeReader.authorizeIn(transaction, {
    actor,
    projectId: candidate.projectId,
    workstreamId: candidate.workstreamId,
    workItemId: candidate.workItemId,
    at,
  });
  await lockSession(transaction, id);
  return ownedSession(transaction, actor, id);
}

async function lockSession(transaction: Transaction, id: string) {
  await transaction.$queryRaw`SELECT id FROM "VoiceUpdateSession" WHERE id = ${id}::uuid FOR UPDATE`;
}

async function validatedSessionUpload(
  transaction: Transaction,
  session: Readonly<{ uploadedSourceId: string; employeeId: string; projectId: string; workstreamId: string | null }>,
) {
  const upload = await transaction.uploadedSource.findFirst({
    where: { id: session.uploadedSourceId, createdById: session.employeeId },
    select: {
      id: true,
      detectedMime: true,
      byteSize: true,
      projectId: true,
      workstreamId: true,
      workstream: { select: { projectId: true } },
    },
  });
  if (
    upload === null ||
    (upload.projectId ?? upload.workstream?.projectId) !== session.projectId ||
    upload.workstreamId !== session.workstreamId ||
    !ACCEPTED_AUDIO_MIME_TYPES.has(upload.detectedMime) ||
    upload.byteSize < 1 ||
    upload.byteSize > MAX_VOICE_AUDIO_BYTES
  ) {
    throw new AppError("VOICE_AUDIO_INVALID", "errors.voice.audioInvalid", 422);
  }
  return upload;
}
function serialize(session: { id: string; state: string; language: string | null; dialect: string | null; transcriptRevisions: Array<{ revision: number; transcript: string }>; confirmation?: unknown | null }) { const latest = session.transcriptRevisions[0]; return { sessionId: session.id, state: session.state, transcript: latest?.transcript ?? null, revision: latest?.revision ?? null, language: session.language, dialect: session.dialect, transcriptConfirmed: session.confirmation !== null && session.confirmation !== undefined }; }
