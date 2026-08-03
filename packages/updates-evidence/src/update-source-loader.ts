import { AppError } from "@evaluation/contracts";

type Transaction = import("@evaluation/database").DatabaseTransaction;

export type LoadedUpdateSources = Readonly<{
  untrustedText: string;
  sourceReferences: readonly string[];
}>;

/** Loads scoped, bounded untrusted input without exposing private object keys. */
export class PrismaUpdateSourceLoader {
  async loadIn(
    transaction: Transaction,
    input: Readonly<{
      updateSourceId: string;
      employeeId: string;
      projectId: string;
      workstreamId: string | null;
    }>,
  ): Promise<LoadedUpdateSources> {
    const attachments = await transaction.updateSourceAttachment.findMany({
      where: { updateSourceId: input.updateSourceId },
      orderBy: { position: "asc" },
      include: {
        uploadedSource: {
          select: {
            id: true,
            createdById: true,
            projectId: true,
            workstreamId: true,
            originalFilename: true,
            detectedMime: true,
            byteSize: true,
            sha256: true,
          },
        },
        voiceSession: {
          select: {
            id: true,
            state: true,
            employeeId: true,
            projectId: true,
            workstreamId: true,
            confirmation: {
              select: {
                transcriptRevisionId: true,
                transcriptRevision: { select: { transcript: true } },
              },
            },
          },
        },
      },
    });
    if (attachments.length === 0) throw invalidSource();

    let remaining = 50_000;
    const chunks: string[] = [];
    for (const attachment of attachments) {
      const reference = `update-source-attachment:${attachment.id}:${attachment.sourceVersion}`;
      let content: string;
      if (attachment.uploadedSourceId !== null) {
        const upload = attachment.uploadedSource;
        if (
          upload === null ||
          upload.createdById !== input.employeeId ||
          upload.projectId !== input.projectId ||
          (upload.workstreamId !== null && upload.workstreamId !== input.workstreamId)
        ) {
          throw scopeError();
        }
        content = `[inspected upload: ${upload.originalFilename}; ${upload.detectedMime}; ${upload.byteSize} bytes; sha256 ${upload.sha256}]`;
      } else if (attachment.voiceSessionId !== null) {
        const voice = attachment.voiceSession;
        if (
          voice === null ||
          voice.state !== "transcript_confirmed" ||
          voice.employeeId !== input.employeeId ||
          voice.projectId !== input.projectId ||
          voice.workstreamId !== input.workstreamId ||
          voice.confirmation === null
        )
          throw scopeError();
        content = voice.confirmation.transcriptRevision.transcript;
      } else {
        content = attachment.content ?? attachment.sourceUrl ?? "";
      }
      const bounded = content.slice(0, Math.max(0, remaining));
      remaining -= bounded.length;
      chunks.push(
        `<<BEGIN_UNTRUSTED_UPDATE_SOURCE kind=${attachment.kind} reference=${reference}>>\n${bounded}\n<<END_UNTRUSTED_UPDATE_SOURCE>>`,
      );
      if (remaining === 0) break;
    }
    const untrustedText = chunks.join("\n\n");
    if (untrustedText.trim().length === 0) throw invalidSource();
    return {
      untrustedText,
      sourceReferences: attachments.map(
        (attachment) => `update-source-attachment:${attachment.id}:${attachment.sourceVersion}`,
      ),
    };
  }
}

function invalidSource(): AppError {
  return new AppError("UPDATE_SOURCE_INVALID", "errors.updates.sourceInvalid", 422);
}

function scopeError(): AppError {
  return new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
}
