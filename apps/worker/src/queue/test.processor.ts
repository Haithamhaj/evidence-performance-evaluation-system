export async function testProcessor(
  envelope: import("@evaluation/contracts").JobEnvelope,
): Promise<string> {
  return `operation:${envelope.operationId}`;
}
