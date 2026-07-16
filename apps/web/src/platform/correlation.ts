import {
  CORRELATION_HEADER,
  createCorrelationCarrier,
  isValidCorrelationId,
} from "@evaluation/observability";

export function createWebCorrelationHeaders(
  incoming?: HeadersInit,
  createId: () => string = () => createCorrelationCarrier().correlationId,
): Headers {
  const headers = new Headers(incoming);
  const incomingId = headers.get(CORRELATION_HEADER);
  const correlationId = isValidCorrelationId(incomingId) ? incomingId : createId();
  const carrier = createCorrelationCarrier(correlationId);

  headers.set(CORRELATION_HEADER, carrier.correlationId);
  return headers;
}
