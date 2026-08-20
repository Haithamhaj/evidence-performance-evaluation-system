// @vitest-environment jsdom
/* eslint-disable no-unused-vars */
import { getCatalogSync } from "@evaluation/localization";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportCenter } from "./report-center.js";

afterEach(() => cleanup());

describe("ReportCenter", () => {
  it("shows authorized report state and opens only a ready artifact", async () => {
    const open = vi.fn(async () => ({ href: "" }));
    render(
      <ReportCenter
        catalog={getCatalogSync("en")}
        initialItems={[
          report("22222222-2222-4222-8222-222222222222", "READY"),
          report("33333333-3333-4333-8333-333333333333", "EXPIRED"),
        ]}
        locale="en"
        onOpen={open}
      />,
    );

    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
  });

  it("requires an explicit reason before revoking a ready artifact", async () => {
    const revoke = vi.fn(async () => true);
    render(
      <ReportCenter
        catalog={getCatalogSync("en")}
        initialItems={[report("22222222-2222-4222-8222-222222222222", "READY")]}
        locale="en"
        onOpen={vi.fn()}
        onRevoke={revoke}
      />,
    );

    fireEvent.change(screen.getByLabelText("Revocation reason"), {
      target: { value: "Generated for the wrong review meeting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(screen.getByText("Revoked")).toBeTruthy());
  });
});

function report(id: string, state: "EXPIRED" | "READY") {
  return {
    id,
    reportType: "EMPLOYEE_EVALUATION" as const,
    audience: "EMPLOYEE_SELF" as const,
    format: "PDF" as const,
    locale: "en" as const,
    state,
    artifactId: state === "READY" ? "44444444-4444-4444-8444-444444444444" : null,
    expiresAt: "2026-08-16T08:00:00.000Z",
    createdAt: "2026-08-15T08:00:00.000Z",
  };
}
