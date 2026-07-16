import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { BidiText } from "./bidi-text.js";

describe("BidiText", () => {
  it("uses automatic isolation for user text", () => {
    expect(
      renderToStaticMarkup(
        createElement(BidiText, { kind: "auto-isolate", children: "مرحبا OpenAI" }),
      ),
    ).toBe('<bdi data-bidi-kind="auto-isolate">مرحبا OpenAI</bdi>');
  });

  it.each(["code", "url", "email", "model", "path", "hash"] as const)(
    "isolates %s content explicitly as LTR",
    (kind) => {
      const markup = renderToStaticMarkup(
        createElement(BidiText, { kind, children: "sample/value" }),
      );

      expect(markup).toContain('dir="ltr"');
      expect(markup).toContain(`data-bidi-kind="${kind}"`);
    },
  );
});
