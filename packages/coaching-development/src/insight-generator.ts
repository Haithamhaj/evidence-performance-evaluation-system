/* eslint-disable no-unused-vars */
import { AppError, CoachingInsightSchema } from "@evaluation/contracts";

import type { CoachingFact } from "./ports.js";

export class CoachingInsightGenerator {
  draft(
    input: Readonly<{
      employeeId: string;
      period: { startsAt: string; endsAt: string };
      facts: readonly CoachingFact[];
    }>,
  ) {
    const facts = qualifyCoachingFacts(input.facts);
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
      confidenceBasis: reviewRequired
        ? "Only one qualifying source is available."
        : "Multiple qualifying sources are available.",
      limitations: ["Cannot infer performance rating."],
      conflicts: [],
      cannotConclude: "Cannot infer performance rating.",
      version: 1,
      createdAt: new Date().toISOString(),
    });
  }
}

export function qualifyCoachingFacts(facts: readonly CoachingFact[]) {
  const qualified = facts.filter((fact) => qualifies(fact));
  if (qualified.length === 1 && isNegativeSingleIncident(qualified[0]!.text)) return [];
  return qualified;
}

function qualifies(fact: CoachingFact) {
  const text = fact.text.toLowerCase();
  return (
    text.trim().length > 0 &&
    !/\b\d+\s+(updates|commits|tasks|activities|pull requests|prs|tickets)\b/u.test(text) &&
    !/\b(?:approved\s+)?leave\b|إجازة/u.test(text)
  );
}
function isNegativeSingleIncident(text: string) {
  return /\b(?:one|single|isolated)\s+(?:incident|event|case)\b.{0,100}\b(?:miss|fail|delay|late|error|problem|block)/iu.test(
    text,
  );
}
function error(code: string, status: number) {
  return new AppError(code, "errors.coaching.invalid", status);
}
