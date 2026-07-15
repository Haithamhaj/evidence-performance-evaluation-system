import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const CORRELATION_HEADER = "x-correlation-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/u;
const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/u;
const CARRIER_FIELDS = new Set(["correlationId", "traceId", "spanId"]);

export interface CorrelationCarrier {
  readonly correlationId: string;
  readonly traceId?: string;
  readonly spanId?: string;
}

export interface TraceFields {
  readonly traceId?: string;
  readonly spanId?: string;
}

const storage = new AsyncLocalStorage<CorrelationCarrier>();

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function assertTraceField(name: "traceId" | "spanId", value: string | undefined): void {
  if (value === undefined) return;

  const pattern = name === "traceId" ? TRACE_ID_PATTERN : SPAN_ID_PATTERN;
  if (!pattern.test(value) || /^0+$/u.test(value)) {
    throw new TypeError(`${name} must be a non-zero lowercase hexadecimal identifier`);
  }
}

export function createCorrelationCarrier(
  correlationId: string = randomUUID(),
  trace: TraceFields = {},
): CorrelationCarrier {
  if (!isValidCorrelationId(correlationId)) {
    throw new TypeError("correlationId must be a UUID");
  }
  assertTraceField("traceId", trace.traceId);
  assertTraceField("spanId", trace.spanId);

  return Object.freeze({
    correlationId: correlationId.toLowerCase(),
    ...(trace.traceId === undefined ? {} : { traceId: trace.traceId }),
    ...(trace.spanId === undefined ? {} : { spanId: trace.spanId }),
  });
}

export function restoreCorrelationCarrier(value: unknown): CorrelationCarrier {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("correlation carrier must be an object");
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !CARRIER_FIELDS.has(key))) {
    throw new TypeError("correlation carrier contains an unknown field");
  }
  if (typeof record.correlationId !== "string") {
    throw new TypeError("correlation carrier requires correlationId");
  }
  if (record.traceId !== undefined && typeof record.traceId !== "string") {
    throw new TypeError("traceId must be a string");
  }
  if (record.spanId !== undefined && typeof record.spanId !== "string") {
    throw new TypeError("spanId must be a string");
  }

  return createCorrelationCarrier(record.correlationId, {
    ...(record.traceId === undefined ? {} : { traceId: record.traceId }),
    ...(record.spanId === undefined ? {} : { spanId: record.spanId }),
  });
}

export function serializeCorrelationCarrier(carrier: CorrelationCarrier): CorrelationCarrier {
  return restoreCorrelationCarrier(carrier);
}

export function runWithCorrelation<T>(carrier: CorrelationCarrier, callback: () => T): T {
  return storage.run(restoreCorrelationCarrier(carrier), callback);
}

export function currentCorrelation(): CorrelationCarrier | undefined {
  return storage.getStore();
}
