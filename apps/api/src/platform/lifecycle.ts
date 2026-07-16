interface ShutdownHookApplication {
  enableShutdownHooks(): unknown;
}

export function enableGracefulShutdown(application: ShutdownHookApplication): void {
  application.enableShutdownHooks();
}
