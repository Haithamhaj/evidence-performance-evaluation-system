import { randomUUID } from "node:crypto";

import { Catch } from "@nestjs/common";

import { AppError, ErrorEnvelopeSchema } from "@evaluation/contracts";
import { currentCorrelation, isValidCorrelationId } from "@evaluation/observability";

interface HttpResponse {
  status(statusCode: number): {
    json(body: import("@evaluation/contracts").ErrorEnvelope): void;
  };
}

export class AppErrorFilter {
  catch(exception: unknown, host: import("@nestjs/common").ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<{ correlationId?: unknown }>();
    const response = http.getResponse<HttpResponse>();
    const currentId = currentCorrelation()?.correlationId;
    const correlationId = isValidCorrelationId(request.correlationId)
      ? request.correlationId
      : (currentId ?? randomUUID());

    if (exception instanceof AppError) {
      const candidate = {
        code: exception.code,
        messageKey: exception.messageKey,
        correlationId,
        ...(exception.details === undefined ? {} : { details: exception.details }),
      };
      const envelope = ErrorEnvelopeSchema.safeParse(candidate);
      if (
        envelope.success &&
        Number.isInteger(exception.status) &&
        exception.status >= 400 &&
        exception.status <= 599
      ) {
        response.status(exception.status).json(envelope.data);
        return;
      }
    }

    response.status(500).json({
      code: "INTERNAL_ERROR",
      messageKey: "errors.internal",
      correlationId,
    });
  }
}

Catch()(AppErrorFilter);
