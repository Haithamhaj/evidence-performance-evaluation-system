/* eslint-disable no-unused-vars */
import { ExportRequestSchema } from "@evaluation/contracts";
import { ArtifactAccessService, ExportService } from "@evaluation/reporting";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { OperationsPolicyGuard, type OperationsRequest } from "./operations-policy.guard.js";

export class ExportsController {
  constructor(
    private readonly exports: ExportService,
    private readonly access: ArtifactAccessService,
  ) {}

  request(request: OperationsRequest, body: unknown) {
    const parsed = ExportRequestSchema.omit({ schemaVersion: true, requesterId: true }).parse(body);
    return this.exports.request({ ...parsed, requesterId: actor(request) });
  }

  status(request: OperationsRequest, requestId: string) {
    return this.exports.readRequest(actor(request), requestId);
  }

  generate(request: OperationsRequest, requestId: string) {
    return this.exports.generateFor(actor(request), requestId);
  }

  download(request: OperationsRequest, artifactId: string) {
    return this.access.open(actor(request), artifactId, correlation(request));
  }

  revoke(request: OperationsRequest, artifactId: string, body: unknown) {
    const reason = String((body as { reason?: unknown } | null)?.reason ?? "").trim();
    return this.access.revoke(actor(request), artifactId, reason);
  }
}

Controller("api/v1/operations/exports")(ExportsController);
UseGuards(OperationsPolicyGuard)(ExportsController);
Inject(ExportService)(ExportsController, undefined, 0);
Inject(ArtifactAccessService)(ExportsController, undefined, 1);
decorate("request", Post(), [Req(), Body()]);
decorate("status", Get(":requestId"), [Req(), Param("requestId")]);
decorate("generate", Post(":requestId/generate"), [Req(), Param("requestId")]);
decorate("download", Post("artifacts/:artifactId/open"), [Req(), Param("artifactId")]);
decorate("revoke", Post("artifacts/:artifactId/revoke"), [Req(), Param("artifactId"), Body()]);

function actor(request: OperationsRequest) {
  return request.principal!.userId;
}
function correlation(request: OperationsRequest) {
  return request.correlationId ?? crypto.randomUUID();
}
function decorate(
  method: keyof ExportsController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(ExportsController.prototype, method)!;
  parameters.forEach((parameter, index) => parameter(ExportsController.prototype, method, index));
  route(ExportsController.prototype, method, descriptor);
}
