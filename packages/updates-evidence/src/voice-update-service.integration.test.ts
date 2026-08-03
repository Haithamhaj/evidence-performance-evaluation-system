import { afterAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { VoiceUpdateService } from "./voice-update-service.js";
import { UpdateService } from "./update-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-03T12:00:00.000Z");

afterAll(async () => client.$disconnect());

describe("VoiceUpdateService", () => {
  it("uses inspected audio metadata, preserves transcript revisions, and requires employee confirmation", async () => {
    const graph = await seedVoiceGraph();
    const upload = await seedVoiceUpload(graph, 512);
    const transcribe = vi.fn(async (_input) => ({
      transcript: "تم نشر الإصلاح على بيئة الاختبار.",
      language: "ar" as const,
      dialect: "gulf" as const,
      aiRunId: null,
    }));
    const service = serviceFor(graph, { transcribe });
    const idempotencyKey = crypto.randomUUID();
    const command = voiceCommand(graph, upload.id, idempotencyKey);

    const started = await service.start(command);
    expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({ mediaType: "audio/mpeg", byteSize: 512 }));
    expect(started).toMatchObject({ state: "transcript_ready", revision: 1, transcriptConfirmed: false });
    const captured: import("./update-service.js").UpdateStructureContext[] = [];
    const updateService = updateServiceFor(graph, captured);
    await expect(startVoiceUpdate(updateService, graph, started.sessionId)).rejects.toMatchObject({
      code: "VOICE_TRANSCRIPT_CONFIRMATION_REQUIRED",
    });

    const revised = await service.reviseTranscript({
      actor: command.actor,
      voiceSessionId: started.sessionId,
      input: { expectedRevision: 1, transcript: "تم نشر الإصلاح بعد المراجعة." },
    });
    await expect(
      service.confirmTranscript({
        actor: command.actor,
        voiceSessionId: started.sessionId,
        input: { expectedRevision: 1, reason: "Employee reviewed the transcript" },
      }),
    ).rejects.toMatchObject({ code: "VOICE_TRANSCRIPT_CONFIRMATION_REQUIRED" });
    await expect(
      service.confirmTranscript({
        actor: command.actor,
        voiceSessionId: started.sessionId,
        input: { expectedRevision: revised.revision, reason: "Employee reviewed the transcript" },
      }),
    ).resolves.toMatchObject({ state: "transcript_confirmed", transcriptConfirmed: true });
    await expect(startVoiceUpdate(updateService, graph, started.sessionId)).resolves.toMatchObject({
      state: "ready_for_review",
    });
    expect(captured[0]?.rawText).toContain("تم نشر الإصلاح بعد المراجعة.");

    const revisions = await client.voiceTranscriptRevision.findMany({
      where: { voiceSessionId: started.sessionId },
      orderBy: { revision: "asc" },
    });
    expect(revisions.map((revision) => [revision.revision, revision.origin])).toEqual([
      [1, "ai"],
      [2, "employee"],
    ]);
    await expect(
      service.start({
        ...command,
        input: { ...command.input, declaredDurationSeconds: command.input.declaredDurationSeconds + 1 },
      }),
    ).rejects.toMatchObject({ code: "VOICE_IDEMPOTENCY_CONFLICT" });
  });

  it("does not mark a successful transcription failed or cleaned when temporary cleanup fails", async () => {
    const graph = await seedVoiceGraph();
    const upload = await seedVoiceUpload(graph, 512);
    const cleanup = vi.fn(async () => {
      throw new Error("temporary-store-unavailable");
    });
    const service = serviceFor(graph, {
      transcribe: async () => ({ transcript: "The deploy passed.", language: "en", dialect: "english", aiRunId: null }),
      cleanup,
    });
    const command = voiceCommand(graph, upload.id, crypto.randomUUID());

    await expect(service.start(command)).rejects.toThrow("temporary-store-unavailable");
    const persisted = await client.voiceUpdateSession.findUniqueOrThrow({
      where: { idempotencyKey: command.input.idempotencyKey },
      include: { transcriptRevisions: true },
    });
    expect(persisted.state).toBe("transcript_ready");
    expect(persisted.temporaryArtifactsCleanedAt).toBeNull();
    expect(persisted.transcriptRevisions).toHaveLength(1);
    expect(cleanup).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
  });

  it("rejects oversized audio before the transcriber can receive it", async () => {
    const graph = await seedVoiceGraph();
    const upload = await seedVoiceUpload(graph, 10 * 1024 * 1024 + 1);
    const transcribe = vi.fn();
    const service = serviceFor(graph, { transcribe });
    await expect(service.start(voiceCommand(graph, upload.id, crypto.randomUUID()))).rejects.toMatchObject({ code: "VOICE_AUDIO_INVALID" });
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("accepts a workstream-scoped upload whose project is derived from the workstream", async () => {
    const graph = await seedVoiceGraph();
    const upload = await client.uploadedSource.create({
      data: {
        organizationId: graph.organizationId, departmentId: graph.departmentId, projectId: null, workstreamId: graph.workstreamId,
        originalFilename: "stream.m4a", objectKey: `private-test/${crypto.randomUUID()}/stream.m4a`, detectedType: "audio", detectedMime: "audio/mp4", byteSize: 512,
        sha256: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"), createdById: graph.employeeId, reason: "Test voice upload",
      },
    });
    const service = serviceFor(graph, { transcribe: async () => ({ transcript: "تم النشر.", language: "ar", dialect: "fusha", aiRunId: null }) });
    const command = voiceCommand(graph, upload.id, crypto.randomUUID());
    await expect(service.start({ ...command, input: { ...command.input, workstreamId: graph.workstreamId } })).resolves.toMatchObject({ state: "transcript_ready" });
  });
});

function serviceFor(
  graph: VoiceGraph,
  options: Readonly<{
    transcribe: (input: unknown) => Promise<{
      transcript: string;
      language: "ar" | "en" | "mixed";
      dialect: "fusha" | "gulf" | "levantine" | "english" | "mixed";
      aiRunId: null;
    }>;
    cleanup?: (input: unknown) => Promise<void>;
  }>,
) {
  return new VoiceUpdateService(
    client,
    {
      authorizeIn: async () => ({
        organizationId: graph.organizationId,
        projectScopeId: graph.projectId,
        departmentScopeId: graph.departmentId,
        activeContract: null,
      }),
    },
    { transcribe: options.transcribe as never },
    { cleanup: options.cleanup ?? (async () => undefined) },
    () => now,
  );
}

function updateServiceFor(graph: VoiceGraph, captured: import("./update-service.js").UpdateStructureContext[]) {
  return new UpdateService(
    client,
    {
      authorizeIn: async () => ({
        organizationId: graph.organizationId,
        projectScopeId: graph.projectId,
        departmentScopeId: graph.departmentId,
        activeContract: null,
      }),
    },
    {
      structure: async (input, persistValidatedOutput) => {
        captured.push(input);
        const output = {
          state: "ready_for_review" as const,
          unresolvedFields: [],
          draft: {
            summary: "Voice update draft",
            result: "Employee will review the source-supported draft.",
            blocker: null,
            nextAction: "Review the draft.",
            contributionContext: "Employee-provided voice transcript.",
            evidenceClaimDrafts: [],
            documentationNeeds: [],
            relatedProgressComponentIds: [],
            comparisonExplanation: "Initial voice capture.",
          },
        };
        await client.$transaction((transaction) => persistValidatedOutput(transaction, output));
        return output;
      },
    },
    { append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }) },
    () => now,
  );
}

function startVoiceUpdate(service: UpdateService, graph: VoiceGraph, voiceSessionId: string) {
  return service.start({
    actor: { userId: graph.employeeId, active: true },
    correlationId: crypto.randomUUID(),
    input: {
      idempotencyKey: crypto.randomUUID(),
      projectId: graph.projectId,
      workstreamId: null,
      workItemId: null,
      rawText: "",
      sources: [{ kind: "voice_transcript", voiceSessionId }],
      executionMode: "ai_assisted",
    },
  });
}

function voiceCommand(graph: VoiceGraph, uploadedSourceId: string, idempotencyKey: string) {
  return {
    actor: { userId: graph.employeeId, active: true },
    correlationId: crypto.randomUUID(),
    input: {
      idempotencyKey,
      uploadedSourceId,
      projectId: graph.projectId,
      workstreamId: null,
      workItemId: null,
      declaredDurationSeconds: 7,
    },
  };
}

type VoiceGraph = Readonly<{ organizationId: string; departmentId: string; employeeId: string; projectId: string; workstreamId: string }>;

async function seedVoiceGraph(): Promise<VoiceGraph> {
  const suffix = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const employeeId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  await client.organization.create({ data: { id: organizationId, key: `voice-org-${suffix}`, name: "Voice" } });
  await client.department.create({ data: { id: departmentId, key: `voice-dept-${suffix}`, name: "Voice", organizationId } });
  await client.user.create({ data: { id: employeeId, email: `voice-${suffix}@example.invalid`, displayName: "Employee" } });
  await client.authorizationScope.createMany({
    data: [
      { id: departmentId, key: `voice-department-${suffix}`, scopeType: "department", departmentId },
      { id: projectId, key: `voice-project-${suffix}`, scopeType: "project", departmentId },
      { id: workstreamId, key: `voice-workstream-${suffix}`, scopeType: "workstream", departmentId },
    ],
  });
  await client.project.create({
    data: {
      id: projectId,
      organizationId,
      departmentId,
      authorizationScopeId: projectId,
      name: "Voice project",
      description: "",
      status: "active",
      createdById: employeeId,
    },
  });
  await client.workstream.create({ data: { id: workstreamId, projectId, authorizationScopeId: workstreamId, name: "Voice stream", description: "", status: "active", createdById: employeeId } });
  return { organizationId, departmentId, employeeId, projectId, workstreamId };
}

async function seedVoiceUpload(graph: VoiceGraph, byteSize: number) {
  return client.uploadedSource.create({
    data: {
      organizationId: graph.organizationId,
      departmentId: graph.departmentId,
      projectId: graph.projectId,
      workstreamId: null,
      originalFilename: "update.mp3",
      objectKey: `private-test/${crypto.randomUUID()}/update.mp3`,
      detectedType: "audio",
      detectedMime: "audio/mpeg",
      byteSize,
      sha256: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
      createdById: graph.employeeId,
      reason: "Test voice upload",
    },
  });
}
