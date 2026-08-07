import { randomUUID } from "node:crypto";

export class ArtifactAccessService {
  private readonly database: import("@evaluation/database").DatabaseClient;
  private readonly storage: import("./export-service.js").ReportObjectStorage;
  private readonly now: () => Date;

  constructor(
    database: import("@evaluation/database").DatabaseClient,
    storage: import("./export-service.js").ReportObjectStorage,
    now: () => Date = () => new Date(),
  ) {
    this.database = database;
    this.storage = storage;
    this.now = now;
  }

  async open(actorId: string, artifactId: string, correlationId: string) {
    const artifact = await this.database.exportArtifact.findUnique({
      where: { id: artifactId },
      include: {
        manifest: { include: { request: true } },
        revocations: { take: 1, orderBy: { revokedAt: "desc" } },
      },
    });
    let reason: "DENIED" | "EXPIRED" | "REVOKED" | "ALLOWED" = "ALLOWED";
    if (!artifact || artifact.manifest.request.requesterId !== actorId) reason = "DENIED";
    else if (artifact.revocations.length > 0) reason = "REVOKED";
    else if (artifact.expiresAt.getTime() <= this.now().getTime()) reason = "EXPIRED";
    await this.database.exportAccessEvent.create({
      data: {
        id: randomUUID(),
        artifactId,
        actorId,
        allowed: reason === "ALLOWED",
        reason,
        correlationId,
        accessedAt: this.now(),
      },
    });
    if (!artifact || reason !== "ALLOWED") return { allowed: false as const, reason };
    const descriptor = await this.storage.signGet({ key: artifact.storageKey, expiresInSeconds: 60 });
    return { allowed: true as const, descriptor, expiresInSeconds: 60 };
  }

  async revoke(actorId: string, artifactId: string, reason: string) {
    const artifact = await this.database.exportArtifact.findUniqueOrThrow({
      where: { id: artifactId },
      include: { manifest: { include: { request: true } } },
    });
    if (artifact.manifest.request.requesterId !== actorId) throw new Error("EXPORT_REVOKE_DENIED");
    return this.database.exportRevocation.create({
      data: { id: randomUUID(), artifactId, actorId, reason, revokedAt: this.now() },
    });
  }
}
