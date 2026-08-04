export function apiPort(environment: NodeJS.ProcessEnv = process.env): number {
  const port = Number.parseInt(environment.API_PORT ?? "3001", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT must be a valid TCP port");
  }
  return port;
}
