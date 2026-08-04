import { describe, expect, it } from "vitest";

import * as publicApi from "./index.js";

describe("AI routing public boundary", () => {
  it("does not expose provider adapters to feature modules", () => {
    expect(publicApi).not.toHaveProperty("PromptAwareOpenAiCompatibleAdapter");
  });
});
