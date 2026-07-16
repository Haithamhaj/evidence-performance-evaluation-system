import {
  CORRELATION_HEADER,
  createCorrelationCarrier,
  isValidCorrelationId,
  runWithCorrelation,
} from "@evaluation/observability";

interface CorrelationRequest {
  readonly headers: Record<string, unknown>;
  correlationId?: string;
}

interface CorrelationResponse {
  setHeader(name: string, value: string): void;
}

export class CorrelationMiddleware {
  use(request: CorrelationRequest, response: CorrelationResponse, next: () => void): void {
    const incoming = request.headers[CORRELATION_HEADER];
    const carrier = createCorrelationCarrier(isValidCorrelationId(incoming) ? incoming : undefined);

    request.correlationId = carrier.correlationId;
    response.setHeader(CORRELATION_HEADER, carrier.correlationId);
    runWithCorrelation(carrier, next);
  }
}
