import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";
import { ExperimentsController } from "./experiments.controller.js";
import { ResearchRecordsController } from "./research-records.controller.js";
import { ResearchExperimentsModule } from "./research-experiments.module.js";
import { SourceReviewsController } from "./source-reviews.controller.js";

describe("ResearchExperimentsModule", () => {
  it("registers the complete protected research API as one bounded module", () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ResearchExperimentsModule);
    expect(controllers).toEqual([
      SourceReviewsController,
      ResearchRecordsController,
      ExperimentsController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ResearchExperimentsModule)).toEqual(
      expect.arrayContaining([expect.any(Object)]),
    );
  });

  it("is installed once in the application module", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);
    expect(imports.filter((entry: unknown) => entry === ResearchExperimentsModule)).toHaveLength(1);
  });
});
