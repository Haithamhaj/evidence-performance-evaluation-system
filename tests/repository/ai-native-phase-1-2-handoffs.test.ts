import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type JsonRecord = Record<string, unknown>;

const handoffPath = "docs/product/ai-native-phase-1-2-handoffs.json";
const capabilityPath = "docs/product/ai-native-frontend-capabilities.json";

describe("AI-native Phase 1–2 implementation handoffs", () => {
  it("accepts the repository handoff contract", () => {
    expect(() =>
      execFileSync("node", ["scripts/validate-ai-native-phase-1-2-handoffs.mjs"], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it.each([
    {
      name: "unknown capability",
      expected: /unknown capability/u,
      mutateHandoffs: (rows: JsonRecord[]) => {
        rows[0]!.capabilityIds = ["CAP-999"];
      },
    },
    {
      name: "duplicate handoff ID",
      expected: /duplicate handoffId/u,
      mutateHandoffs: (rows: JsonRecord[]) => {
        rows[1]!.handoffId = rows[0]!.handoffId;
      },
    },
    {
      name: "missing reader disposition",
      expected: /reader/u,
      mutateHandoffs: (rows: JsonRecord[]) => {
        delete rows[0]!.reader;
      },
    },
    {
      name: "command without permission evidence",
      expected: /permission and negative tests/u,
      mutateHandoffs: (rows: JsonRecord[]) => {
        const command = (rows[2]!.commands as JsonRecord[])[0]!;
        command.permission = "";
        command.negativeTests = [];
      },
    },
    {
      name: "Phase 0B production SSE",
      expected: /cannot implement production SSE/u,
      mutateHandoffs: (rows: JsonRecord[]) => {
        rows[0]!.sse = { disposition: "IMPLEMENTED" };
      },
    },
    {
      name: "unapproved assistance mode",
      expected: /unapproved assistance mode/u,
      mutateHandoffs: (rows: JsonRecord[]) => {
        rows[0]!.assistanceModes = ["master_agent"];
      },
    },
    {
      name: "protected output",
      expected: /protected output field/u,
      mutateHandoffs: (rows: JsonRecord[]) => {
        rows[0]!.outputFields = ["predictedRating"];
      },
    },
    {
      name: "incorrect authoritative API path",
      expected: /apiPath must be/u,
      mutateHandoffs: (rows: JsonRecord[]) => {
        const connectedContext = rows.find((row) => row.handoffId === "P1-CONNECTED-CONTEXT")!;
        const reader = connectedContext.reader as JsonRecord;
        reader.apiPath = "GET /api/v1/workspace/connected-work/context-items";
      },
    },
    {
      name: "incorrect authoritative status totals",
      expected: /status counts/u,
      mutateCapabilities: (rows: JsonRecord[]) => {
        rows[0]!.sourceStatus = "PARTIAL";
      },
    },
  ])("rejects $name", ({ expected, mutateCapabilities, mutateHandoffs }) => {
    const directory = mkdtempSync(join(tmpdir(), "frontend-handoffs-"));
    try {
      const handoffs = JSON.parse(readFileSync(handoffPath, "utf8")) as JsonRecord[];
      const capabilities = JSON.parse(readFileSync(capabilityPath, "utf8")) as JsonRecord[];
      mutateHandoffs?.(handoffs);
      mutateCapabilities?.(capabilities);
      const handoffsFixture = join(directory, "handoffs.json");
      const capabilitiesFixture = join(directory, "capabilities.json");
      writeFileSync(handoffsFixture, JSON.stringify(handoffs));
      writeFileSync(capabilitiesFixture, JSON.stringify(capabilities));

      expect(() =>
        execFileSync(
          "node",
          [
            "scripts/validate-ai-native-phase-1-2-handoffs.mjs",
            handoffsFixture,
            capabilitiesFixture,
          ],
          { stdio: "pipe" },
        ),
      ).toThrow(expected);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
