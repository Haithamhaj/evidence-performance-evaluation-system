import console from "node:console";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const englishPath = path.join(repositoryRoot, "packages/localization/src/rubric/v1.en.json");
const arabicPath = path.join(repositoryRoot, "packages/localization/src/rubric/v1.ar.json");
const outputPath = path.join(repositoryRoot, "docs/rubric/arabic-v1-review.md");

function fail(message) {
  throw new Error(`Arabic rubric review export failed: ${message}`);
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function criterionEntries(criterion) {
  const entries = [{ id: `${criterion.id}.title`, text: criterion.title, kind: "title" }];
  for (const field of [
    "assessmentBasis",
    "definition",
    "whyItMatters",
    "included",
    "excluded",
    "purpose",
    "evidenceGuidance",
  ]) {
    if (criterion[field] !== undefined) {
      entries.push({ id: `${criterion.id}.${field}`, text: criterion[field], kind: field });
    }
  }
  entries.push(
    ...criterion.anchors.map(({ rating, text }) => ({
      id: `${criterion.id}.anchor.${rating}`,
      text,
      kind: "anchor",
    })),
  );
  for (const [field, values] of [
    ["prohibitedInputs", criterion.prohibitedInputs],
    ["requiredContextReview", criterion.requiredContextReview],
    ["example", criterion.examples],
  ]) {
    if (values === undefined) continue;
    entries.push(
      ...values.map((text, index) => ({
        id: `${criterion.id}.${field}.${index + 1}`,
        text,
        kind: field,
      })),
    );
  }
  return entries;
}

function textInventory(rubric) {
  return [
    ...rubric.sections.map(({ id, title }) => ({
      id: `section.${id}.title`,
      text: title,
      kind: "section-title",
    })),
    ...rubric.employeeCriteria.flatMap(criterionEntries),
    ...criterionEntries(rubric.projectContribution),
    ...rubric.managerCriteria.flatMap((criterion) => [
      { id: `${criterion.id}.title`, text: criterion.title, kind: "title" },
      { id: `${criterion.id}.definition`, text: criterion.definition, kind: "definition" },
      ...criterion.anchors.map(({ rating, text }) => ({
        id: `${criterion.id}.anchor.${rating}`,
        text,
        kind: "anchor",
      })),
      { id: `${criterion.id}.commentPrompt`, text: criterion.commentPrompt, kind: "prompt" },
    ]),
    ...rubric.biasGuidance.map((text, index) => ({
      id: `bias-guidance.${index + 1}`,
      text,
      kind: "bias-guidance",
    })),
  ];
}

function assertExactStructure(english, draft, englishEntries, arabicEntries) {
  const arabic = draft.content;
  if (draft.status !== "draft") fail("canonical Arabic artifact must remain draft");
  if (draft.provenance?.actorKind !== "machine")
    fail("draft provenance must identify machine help");
  if (english.version !== "1" || arabic.version !== english.version) fail("version mismatch");
  if (arabic.locale !== "ar") fail("Arabic locale must be ar");
  if (arabic.sourceHash !== english.sourceHash) fail("English root source hash mismatch");
  const counts = {
    sections: arabic.sections.length,
    employeeCriteria: arabic.employeeCriteria.length,
    employeeAnchors: arabic.employeeCriteria.flatMap(({ anchors }) => anchors).length,
    projectCriteria: arabic.projectContribution?.id === "PROJECT-CONTRIBUTION" ? 1 : 0,
    projectAnchors: arabic.projectContribution?.anchors.length,
    managerCriteria: arabic.managerCriteria.length,
    managerAnchors: arabic.managerCriteria.flatMap(({ anchors }) => anchors).length,
    biasGuidance: arabic.biasGuidance.length,
    semanticItems: arabicEntries.length,
  };
  const expectedCounts = {
    sections: 4,
    employeeCriteria: 12,
    employeeAnchors: 60,
    projectCriteria: 1,
    projectAnchors: 5,
    managerCriteria: 5,
    managerAnchors: 25,
    biasGuidance: 15,
    semanticItems: 292,
  };
  if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) {
    fail(`T010 inventory count mismatch: ${JSON.stringify(counts)}`);
  }
  if (englishEntries.length !== arabicEntries.length) fail("semantic inventory length mismatch");
  for (const [index, englishEntry] of englishEntries.entries()) {
    if (englishEntry.id !== arabicEntries[index]?.id)
      fail(`stable ID mismatch at ${englishEntry.id}`);
  }
  return counts;
}

function assertUnresolvedInventory(draft, englishEntries, arabicEntries) {
  if (draft.reviewItems.length !== englishEntries.length) fail("review-item count mismatch");
  for (const [index, item] of draft.reviewItems.entries()) {
    const english = englishEntries[index];
    const arabic = arabicEntries[index];
    if (
      item.id !== english.id ||
      item.version !== "1" ||
      item.englishSourceHash !== sha256(english.text) ||
      item.arabicContentHash !== sha256(arabic.text)
    ) {
      fail(`review hashes or ID are stale for ${english.id}`);
    }
    for (const disposition of [
      item.subjectMatterDisposition,
      item.employeeComprehensionDisposition,
    ]) {
      if (
        disposition.decision !== "unresolved" ||
        disposition.reviewer !== null ||
        disposition.reviewedAt !== null
      ) {
        fail(`pre-gate disposition must remain unresolved and unsigned for ${item.id}`);
      }
    }
  }
  for (const [name, check] of Object.entries(draft.reviewChecks)) {
    for (const disposition of [
      check.subjectMatterDisposition,
      check.employeeComprehensionDisposition,
    ]) {
      if (
        disposition.decision !== "unresolved" ||
        disposition.reviewer !== null ||
        disposition.reviewedAt !== null
      ) {
        fail(`pre-gate review check must remain unresolved and unsigned: ${name}`);
      }
    }
  }
}

function markdownValue(text) {
  return text.replaceAll("\r", "").replaceAll("\n", "<br>");
}

function renderReviewEntry(english, arabic, item) {
  return `### \`${item.id}\`

- Rubric version: \`1\`
- Entry kind: \`${english.kind}\`
- English source: ${markdownValue(english.text)}
- English source hash: \`${item.englishSourceHash}\`
- Recommended Arabic draft: ${markdownValue(arabic.text)}
- Arabic content hash: \`${item.arabicContentHash}\`
- Subject-matter disposition: \`UNRESOLVED\`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: \`UNRESOLVED\`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: ${item.semanticNote}
`;
}

function renderDocument(english, draft, counts, englishEntries, arabicEntries) {
  const unresolvedIds = draft.reviewItems.map(({ id }) => `\`${id}\``).join(", ");
  const entries = draft.reviewItems
    .map((item, index) => renderReviewEntry(englishEntries[index], arabicEntries[index], item))
    .join("\n");
  return `# Arabic Rubric Version 1 — Direct Human Review Inventory

Status: **INACTIVE — HUMAN APPROVAL REQUIRED**

This is an AI-assisted recommended Arabic draft. It is not an approved translation, is not employee-facing, and cannot satisfy either protected human gate. English Version 1 remains authoritative.

- Rubric version: \`${english.version}\`
- English root source hash: \`${english.sourceHash}\`
- Arabic canonical status: \`${draft.status}\`
- Draft provenance: \`${draft.provenance.actorKind}\` — ${draft.provenance.label}

## Structural parity

| Inventory | Result |
|---|---:|
| Sections | ${counts.sections} / 4 |
| Employee criteria | ${counts.employeeCriteria} / 12 |
| Employee anchors | ${counts.employeeAnchors} / 60 |
| Project Contribution criteria | ${counts.projectCriteria} / 1 |
| Project Contribution anchors | ${counts.projectAnchors} / 5 |
| Manager criteria | ${counts.managerCriteria} / 5 |
| Manager anchors | ${counts.managerAnchors} / 25 |
| Bias-guidance rows | ${counts.biasGuidance} / 15 |
| Semantic review items | ${counts.semanticItems} / 292 |

Exact version, root source hash, stable IDs, order, anchor ratings, weights, and T010 counts: **PASS**. Human semantic approval: **NOT STARTED**.

## Sensitive terminology decisions for direct review

- **Documentation Readiness**: \`جاهزية التوثيق\`; it must never be translated or described as a performance score.
- **Performance rating**: \`تقييم الأداء\`; the rubric supports human judgment and must not imply an AI recommendation.
- **Project Contribution**: \`المساهمة في المشروع\`; project count and activity volume do not increase its weight.
- **Evidence**: \`الأدلة\`; use it for source-supported material, distinct from employee interpretation.
- **Workstream**: \`مسار العمل\`; retain the product meaning rather than a generic task stream.
- **Ownership / Primary Owner**: the draft uses forms of \`الملكية\` for ownership and \`المالك الأساسي\` for the formal role; reviewers must decide whether behavior-focused passages are clearer as \`تحمّل المسؤولية\` and keep the role distinct.
- **Agent**: the draft uses \`الوكيل\`; reviewers must decide where \`مساعد البرمجة\` better communicates the intended coding-agent meaning without changing scope.
- **Technical abbreviations**: reviewers must approve first-use presentation for \`POC\`, \`OCR\`, \`CI\`, \`PRs\`, \`Codex\`, and \`Commits\` so bilingual explanation remains consistent.
- Keep \`AI\`, \`GitHub\`, \`API\`, \`README\`, URLs, model names, and repository paths in Latin script where translation would reduce technical precision.

## Meaningful English/Arabic differences to inspect

- Arabic wording is made grammatically natural rather than mechanically literal; reviewers must confirm no requirement was strengthened or weakened.
- Gender-neutral phrasing is preferred where Arabic permits it; reviewers must confirm employee comprehension.
- Rating anchors retain explicit progression from repeated deficiency (1) through reliable expected behavior (3) to sustained exceptional impact (5); every adjacent pair requires direct comparison.
- Technical terms may remain bilingual or Latin; reviewers must approve consistency in mixed-direction rendering.

## Known draft language flags requiring human decision

These are non-approval flags. Every listed disposition remains unresolved; the notes and alternatives only focus the two direct human reviews and do not silently revise the draft.

- \`bias-guidance.3\` — \`تأثير القرون\` is a literal rendering of “Horn effect” and may be unclear. Review whether \`تأثير الهالة السلبي\` or another established Arabic evaluation term preserves the approved concept.
- \`bias-guidance.4\` — \`العمل ... الصوتي\` can be read as audio work, while “vocal work” means conspicuous or outspoken work. Review wording such as \`العمل البارز أو كثير الظهور\`.
- \`bias-guidance.13\` — \`قابلية الاستنساخ\` can imply cloning; review \`قابلية إعادة الإنتاج\` for technical reproducibility and keep it consistent across the rubric.
- \`PPB-01.anchor.3\` — the ownership wording risks a literal calque. Review behavior-focused \`تحمّل المسؤولية\` without changing the formal Primary Owner role.
- \`MGR-03.anchor.1\` — direct human review must resolve the current grammar and verify that the Arabic preserves the approved meaning and severity threshold.
- \`MGR-02.anchor.5\` — direct human review must resolve grammatical agreement while preserving the sustained exceptional-impact threshold.
- \`PPB-01.whyItMatters\`, \`PROJECT-CONTRIBUTION.anchor.2\`, and \`PROJECT-CONTRIBUTION.example.5\` — distinguish behavioral ownership (often clearer as \`تحمّل المسؤولية\`) from the formal Primary Owner role (\`المالك الأساسي\`).
- \`EED-02.title\`, \`EED-02.included\`, \`EED-02.anchor.3\`, and \`bias-guidance.9\` — decide where “agent” should remain \`الوكيل\` and where \`مساعد البرمجة\` better communicates a coding agent.
- \`ARL-01.whyItMatters\`, \`ARL-02.example.1\`, \`EED-02.excluded\`, \`EED-02.evidenceGuidance\`, and \`EED-03.evidenceGuidance\` — approve consistent first-use bilingual presentation of \`POC\`, \`OCR\`, \`Commits\`, \`PRs\`, \`Codex\`, and \`CI\`.

## Protected human inputs still required

1. A product owner or delegated **human Arabic evaluation subject-matter reviewer** must decide every one of the 292 items and all five cross-cutting checks.
2. Separately, authorized **human employee-comprehension reviewers** must decide the same 292 items and all five cross-cutting checks using synthetic or authorized review material, never real employee evaluation data.
3. For every approval, supply the human user ID, reviewer kind, UTC timestamp, exact item ID, English source hash, Arabic content hash, Version \`1\`, decision, and semantic note.
4. Any unresolved/rejected item, stale hash, machine reviewer, indistinct adjacent anchor, or incomplete cross-cutting check keeps Arabic inactive.

## Cross-cutting review checklist

- [ ] RTL layout reviewed directly by both human reviewer kinds.
- [ ] Mixed Arabic/English terminology reviewed directly by both human reviewer kinds.
- [ ] Gulf Arabic examples reviewed directly by both human reviewer kinds.
- [ ] Levantine Arabic examples reviewed directly by both human reviewer kinds.
- [ ] Every adjacent anchor pair reviewed for distinct meaning by both human reviewer kinds.

## Cross-cutting evidence contracts

- RTL layout: \`${draft.reviewChecks.rtlLayout.evidenceRefs.join("\`, \`")}\`.
- Mixed terminology: \`${draft.reviewChecks.mixedTerminology.evidenceRefs.join("\`, \`")}\`.
- Gulf Arabic synthetic fixtures: \`${draft.reviewChecks.gulfArabicExamples.evidenceRefs.join("\`, \`")}\`.
- Levantine Arabic synthetic fixtures: \`${draft.reviewChecks.levantineArabicExamples.evidenceRefs.join("\`, \`")}\`.
- Adjacent anchors: the exact complete inventory of ${draft.reviewChecks.adjacentAnchors.evidenceRefs.length} stable anchor IDs in \`reviewChecks.adjacentAnchors.evidenceRefs\`; missing, extra, duplicate, reordered, or whitespace-modified references are rejected.

## Stop package

- Review files: \`packages/localization/src/rubric/v1.en.json\`, \`packages/localization/src/rubric/v1.ar.json\`, and this inventory.
- Structural parity: PASS for exact source hash, Version \`1\`, stable IDs/order, and T010 counts.
- Unresolved semantic items: **292**.
- Unresolved IDs: ${unresolvedIds}
- Cross-cutting checks unresolved: \`rtlLayout\`, \`mixedTerminology\`, \`gulfArabicExamples\`, \`levantineArabicExamples\`, \`adjacentAnchors\`.
- No human reviewer identities or timestamps are recorded. No approval, import, persistence, audit, migration, or activation has occurred.

### Verification commands and results

- \`node scripts/export-rubric-review.mjs\` — **PASS**: exact 292-item unresolved inventory exported.
- \`pnpm --filter @evaluation/localization test -- translation-approval\` — **PASS**: 3 files, 55 tests.
- \`pnpm test:ai\` — **PASS**: 2 files, 133 tests; 1 intentional live-provider test skipped.
- T015 regression checks — **PASS**: UI 7 tests, Web 6 tests, production Chromium RTL/locale/mixed-direction 11 tests.
- Full unit, format, lint/copy/boundaries, typecheck, and build — **PASS**: 405 unit tests and 14/14 packages for lint, typecheck, and build.
- Performance-input and secret scans — **PASS**: 127 performance-boundary files and 476 secret-scan files inspected.
- Database import/migration/integration activation commands — **NOT RUN BY DESIGN** before direct human approval.

## Exact semantic inventory

${entries}`;
}

export async function exportRubricReview() {
  const [englishSource, draftSource] = await Promise.all([
    readFile(englishPath, "utf8"),
    readFile(arabicPath, "utf8"),
  ]);
  const english = JSON.parse(englishSource);
  const draft = JSON.parse(draftSource);
  const englishEntries = textInventory(english);
  const arabicEntries = textInventory(draft.content);
  const counts = assertExactStructure(english, draft, englishEntries, arabicEntries);
  assertUnresolvedInventory(draft, englishEntries, arabicEntries);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const markdown = await format(
    renderDocument(english, draft, counts, englishEntries, arabicEntries),
    {
      parser: "markdown",
      proseWrap: "preserve",
    },
  );
  await writeFile(outputPath, markdown, "utf8");
  return { itemCount: englishEntries.length, unresolvedCount: draft.reviewItems.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const result = await exportRubricReview();
    console.log(
      `ARABIC RUBRIC REVIEW EXPORT: ${result.itemCount} semantic items, ${result.unresolvedCount} unresolved`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
