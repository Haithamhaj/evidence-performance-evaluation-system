import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const planPath = resolve(root, "docs/superpowers/plans/2026-08-11-ai-native-frontend-phase-1.md");
const handoffs = JSON.parse(
  readFileSync(resolve(root, "docs/product/ai-native-phase-1-2-handoffs.json"), "utf8"),
) as Array<{ capabilityIds: string[]; handoffId: string }>;

const requiredFields = [
  "Visible user outcome",
  "Dependencies",
  "Handoff IDs",
  "Capability IDs",
  "Reader",
  "Command",
  "Permission",
  "Assistance mode",
  "States",
  "Files/modules",
  "Focused tests",
  "Runnable local demo",
  "Screenshots",
  "Rollback",
  "Product Owner stop gate",
] as const;

function parseTasks(markdown: string) {
  const sections = markdown.split(/^## (?=T\d{3} — )/mu).slice(1);
  return sections.map((section) => {
    const [heading = "", ...lines] = section.split("\n");
    const id = /^T\d{3}/u.exec(heading)?.[0] ?? "";
    const fields = new Map<string, string>();
    for (const line of lines) {
      const match = /^\*\*([^*]+):\*\*\s+(.+)$/u.exec(line);
      if (match?.[1] && match[2]) fields.set(match[1], match[2]);
    }
    return { fields, id };
  });
}

describe("AI-native Phase 1 executable task graph", () => {
  test("defines the eight ordered, reversible vertical slices", () => {
    const tasks = parseTasks(readFileSync(planPath, "utf8"));
    expect(tasks.map(({ id }) => id)).toEqual([
      "T087",
      "T088",
      "T089",
      "T090",
      "T091",
      "T092",
      "T093",
      "T094",
    ]);
    for (const task of tasks) {
      for (const field of requiredFields)
        expect(task.fields.get(field), `${task.id}:${field}`).toBeTruthy();
    }
  });

  test("maps every slice to approved handoffs and capabilities", () => {
    const knownHandoffs = new Map(handoffs.map((item) => [item.handoffId, item]));
    const tasks = parseTasks(readFileSync(planPath, "utf8"));
    for (const task of tasks) {
      const handoffIds = task.fields.get("Handoff IDs")?.match(/P[12]-[A-Z-]+/gu) ?? [];
      const capabilityIds = task.fields.get("Capability IDs")?.match(/CAP-\d{3}/gu) ?? [];
      expect(handoffIds.length, `${task.id}:handoffs`).toBeGreaterThan(0);
      expect(capabilityIds.length, `${task.id}:capabilities`).toBeGreaterThan(0);
      for (const handoffId of handoffIds) expect(knownHandoffs.has(handoffId)).toBe(true);
      const supportedCapabilities = new Set(
        handoffIds.flatMap((handoffId) => knownHandoffs.get(handoffId)?.capabilityIds ?? []),
      );
      for (const capabilityId of capabilityIds)
        expect(supportedCapabilities.has(capabilityId)).toBe(true);
    }
  });

  test("uses only known earlier task dependencies", () => {
    const tasks = parseTasks(readFileSync(planPath, "utf8"));
    const taskIds = new Set(tasks.map(({ id }) => id));
    for (const [index, task] of tasks.entries()) {
      const dependencies = task.fields.get("Dependencies")?.match(/T\d{3}/gu) ?? [];
      for (const dependency of dependencies) {
        if (!taskIds.has(dependency)) {
          expect(Number(dependency.slice(1))).toBeLessThan(87);
          continue;
        }
        expect(tasks.findIndex(({ id }) => id === dependency)).toBeLessThan(index);
      }
    }
  });
});
