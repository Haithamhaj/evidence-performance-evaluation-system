// @vitest-environment jsdom

import { getCatalogSync } from "@evaluation/localization";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { EvaluationFactsLanding } from "./evaluation-facts-landing.js";

describe("EvaluationFactsLanding", () => {
  it("explains the human-opened cycle gate instead of rendering a dead route", () => {
    render(createElement(EvaluationFactsLanding, { catalog: getCatalogSync("en"), locale: "en" }));

    expect(
      screen.getByRole("heading", { name: "No evaluation cycle is open yet" }).textContent,
    ).toBe("No evaluation cycle is open yet");
    expect(screen.getByRole("link", { name: "Open Insights" }).getAttribute("href")).toBe(
      "/en/insights",
    );
    expect(screen.queryByText(/recommended rating|predicted rating/iu)).toBeNull();
  });
});
