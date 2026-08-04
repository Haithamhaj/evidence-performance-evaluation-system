export function workerHealthPort(environment: NodeJS.ProcessEnv = process.env): number {
  const port = Number.parseInt(environment.WORKER_HEALTH_PORT ?? "3002", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("WORKER_HEALTH_PORT must be a valid TCP port");
  }
  return port;
}
