import { beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module.js";

const { create, app } = vi.hoisted(() => {
  const app = { useGlobalFilters: vi.fn(), listen: vi.fn(async () => undefined) };
  return { app, create: vi.fn(async () => app) };
});

vi.mock("@nestjs/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nestjs/core")>()),
  NestFactory: { create },
}));
vi.mock("./platform/api-port.js", () => ({ apiPort: () => 0 }));
vi.mock("./platform/error.filter.js", () => ({ AppErrorFilter: class AppErrorFilter {} }));
vi.mock("./platform/lifecycle.js", () => ({ enableGracefulShutdown: vi.fn() }));

beforeAll(async () => {
  await import("./main.js");
});

describe("production API bootstrap", () => {
  it("enables Nest raw-body capture for GitHub HMAC verification", () => {
    expect(create).toHaveBeenCalledWith(AppModule, { rawBody: true });
    expect(app.listen).toHaveBeenCalledOnce();
  });
});
