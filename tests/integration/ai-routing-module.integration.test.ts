import { NestFactory } from "@nestjs/core";

import { AppModule } from "../../apps/api/src/app.module.js";
import { AiRouteManagementService } from "../../apps/api/src/ai-routing/ai-routing.module.js";
import { describe, expect, it } from "vitest";

describe.skipIf(!process.env.TEST_DATABASE_URL)("AI routing API module composition", () => {
  it("initializes AppModule with one protected route-management composition", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    try {
      const application = await NestFactory.createApplicationContext(AppModule, {
        abortOnError: false,
        logger: false,
      });
      expect(application.get(AiRouteManagementService)).toBeInstanceOf(AiRouteManagementService);
      await application.close();
    } finally {
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
