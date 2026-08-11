import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("Command Brief token contract", () => {
  it("defines semantic color, density, focus, typography, and layer tokens", () => {
    const tokens = read("./tokens.css");

    for (const token of [
      "--ui-color-canvas",
      "--ui-color-surface",
      "--ui-color-surface-raised",
      "--ui-color-text",
      "--ui-color-text-muted",
      "--ui-color-border",
      "--ui-color-accent",
      "--ui-color-focus",
      "--ui-color-status-attention",
      "--ui-color-status-prepared",
      "--ui-color-status-positive",
      "--ui-density-control-block",
      "--ui-space-page-inline",
      "--ui-radius-panel",
      "--ui-font-body",
      "--ui-layer-dialog",
    ]) {
      expect(tokens).toContain(token);
    }
    expect(tokens).toContain(
      "@layer reset, tokens, foundation, primitives, product, utilities, legacy",
    );
  });

  it("keeps foundation layout logical and preserves visible focus and touch targets", () => {
    const foundation = read("./foundation.css");

    expect(foundation).toContain("padding-inline");
    expect(foundation).toContain("border-block-end");
    expect(foundation).toContain(":focus-visible");
    expect(foundation).toContain("--ui-target-min");
    expect(foundation).not.toMatch(/\b(?:margin|padding|border)-(?:left|right)\b/u);
  });

  it("provides semantic motion with reduced-motion and high-contrast safeguards", () => {
    const motion = read("./motion.css");
    const tokens = read("./tokens.css");

    expect(motion).toContain("prefers-reduced-motion: reduce");
    expect(motion).toContain("--ui-motion-duration");
    expect(tokens).toContain("forced-colors: active");
    expect(tokens).toContain("prefers-contrast: more");
  });

  it("keeps legacy token aliases while temporary routes remain", () => {
    const tokens = read("./tokens.css");

    expect(tokens).toContain("--color-canvas: var(--ui-color-canvas)");
    expect(tokens).toContain("--color-accent: var(--ui-color-accent)");
    expect(tokens).toContain("--space-inline-page: var(--ui-space-page-inline)");
  });
});
