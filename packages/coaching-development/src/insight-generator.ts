import { AppError, CoachingInsightSchema } from "@evaluation/contracts";

import type { CoachingFact } from "./ports.js";

export class CoachingInsightGenerator {
  draft(input: Readonly<{ employeeId: string; period: { startsAt: string; endsAt: string }; facts: readonly CoachingFact[] }>) {
    const facts = input.facts.filter((fact) => qualifies(fact));
    if (facts.length === 0) throw error("COACHING_SOURCE_UNQUALIFIED", 409);
    const reviewRequired = facts.length < 2;
    return CoachingInsightSchema.parse({
      schemaVersion: 1,
      id: globalThis.crypto.randomUUID(),
      employeeId: input.employeeId,
      state: reviewRequired ? "REVIEW_REQUIRED" : "DRAFT",
      pattern: `The cited work records describe: ${facts.map(({ text }) => text).join(" ")}`,
      period: input.period,
      sources: facts.map(({ sourceId, kind }) => ({ sourceId, kind })),
      confidence: reviewRequired ? "REVIEW_REQUIRED" : "SUPPORTED",
      confidenceBasis: reviewRequired ? "Only one qualifying source is available." : "Multiple qualifying sources are available.",
      limitations: ["Cannot infer performance rating."],
      conflicts: [],
      cannotConclude: "Cannot infer performance rating.",
      version: 1,
      createdAt: new Date().toISOString(),
    });
  }
}

function qualifies(fact: CoachingFact) {
  const text = fact.text.toLowerCase();
  return text.trim().length > 0 && !/\b\d+\s+(updates|commits|tasks|activities)\b/u.test(text) && !/\bleave\b/u.test(text);
}
function error(code: string, status: number) { return new AppError(code, "errors.coaching.invalid", status); }
