# Arabic Rubric Version 1 — Direct Human Review Inventory

Status: **INACTIVE — HUMAN APPROVAL REQUIRED**

This is an AI-assisted recommended Arabic draft. It is not an approved translation, is not employee-facing, and cannot satisfy either protected human gate. English Version 1 remains authoritative.

- Rubric version: `1`
- English root source hash: `d5b9c96b0849be1f94e901333f5e42d95f7fabe719969ba8ee2cda5cdf5d67a6`
- Arabic canonical status: `draft`
- Draft provenance: `machine` — AI-assisted recommended Arabic draft requiring direct human subject-matter and employee-comprehension review

## Structural parity

| Inventory                     |    Result |
| ----------------------------- | --------: |
| Sections                      |     4 / 4 |
| Employee criteria             |   12 / 12 |
| Employee anchors              |   60 / 60 |
| Project Contribution criteria |     1 / 1 |
| Project Contribution anchors  |     5 / 5 |
| Manager criteria              |     5 / 5 |
| Manager anchors               |   25 / 25 |
| Bias-guidance rows            |   15 / 15 |
| Semantic review items         | 292 / 292 |

Exact version, root source hash, stable IDs, order, anchor ratings, weights, and T010 counts: **PASS**. Human semantic approval: **NOT STARTED**.

## Sensitive terminology decisions for direct review

- **Documentation Readiness**: `جاهزية التوثيق`; it must never be translated or described as a performance score.
- **Performance rating**: `تقييم الأداء`; the rubric supports human judgment and must not imply an AI recommendation.
- **Project Contribution**: `المساهمة في المشروع`; project count and activity volume do not increase its weight.
- **Evidence**: `الأدلة`; use it for source-supported material, distinct from employee interpretation.
- **Workstream**: `مسار العمل`; retain the product meaning rather than a generic task stream.
- **Ownership / Primary Owner**: the draft uses forms of `الملكية` for ownership and `المالك الأساسي` for the formal role; reviewers must decide whether behavior-focused passages are clearer as `تحمّل المسؤولية` and keep the role distinct.
- **Agent**: the draft uses `الوكيل`; reviewers must decide where `مساعد البرمجة` better communicates the intended coding-agent meaning without changing scope.
- **Technical abbreviations**: reviewers must approve first-use presentation for `POC`, `OCR`, `CI`, `PRs`, `Codex`, and `Commits` so bilingual explanation remains consistent.
- Keep `AI`, `GitHub`, `API`, `README`, URLs, model names, and repository paths in Latin script where translation would reduce technical precision.

## Meaningful English/Arabic differences to inspect

- Arabic wording is made grammatically natural rather than mechanically literal; reviewers must confirm no requirement was strengthened or weakened.
- Gender-neutral phrasing is preferred where Arabic permits it; reviewers must confirm employee comprehension.
- Rating anchors retain explicit progression from repeated deficiency (1) through reliable expected behavior (3) to sustained exceptional impact (5); every adjacent pair requires direct comparison.
- Technical terms may remain bilingual or Latin; reviewers must approve consistency in mixed-direction rendering.

## Known draft language flags requiring human decision

These are non-approval flags. Every listed disposition remains unresolved; the notes and alternatives only focus the two direct human reviews and do not silently revise the draft.

- `bias-guidance.3` — `تأثير القرون` is a literal rendering of “Horn effect” and may be unclear. Review whether `تأثير الهالة السلبي` or another established Arabic evaluation term preserves the approved concept.
- `bias-guidance.4` — `العمل ... الصوتي` can be read as audio work, while “vocal work” means conspicuous or outspoken work. Review wording such as `العمل البارز أو كثير الظهور`.
- `bias-guidance.13` — `قابلية الاستنساخ` can imply cloning; review `قابلية إعادة الإنتاج` for technical reproducibility and keep it consistent across the rubric.
- `PPB-01.anchor.3` — the ownership wording risks a literal calque. Review behavior-focused `تحمّل المسؤولية` without changing the formal Primary Owner role.
- `MGR-03.anchor.1` — direct human review must resolve the current grammar and verify that the Arabic preserves the approved meaning and severity threshold.
- `MGR-02.anchor.5` — direct human review must resolve grammatical agreement while preserving the sustained exceptional-impact threshold.
- `PPB-01.whyItMatters`, `PROJECT-CONTRIBUTION.anchor.2`, and `PROJECT-CONTRIBUTION.example.5` — distinguish behavioral ownership (often clearer as `تحمّل المسؤولية`) from the formal Primary Owner role (`المالك الأساسي`).
- `EED-02.title`, `EED-02.included`, `EED-02.anchor.3`, and `bias-guidance.9` — decide where “agent” should remain `الوكيل` and where `مساعد البرمجة` better communicates a coding agent.
- `ARL-01.whyItMatters`, `ARL-02.example.1`, `EED-02.excluded`, `EED-02.evidenceGuidance`, and `EED-03.evidenceGuidance` — approve consistent first-use bilingual presentation of `POC`, `OCR`, `Commits`, `PRs`, `Codex`, and `CI`.

## Protected human inputs still required

1. A product owner or delegated **human Arabic evaluation subject-matter reviewer** must decide every one of the 292 items and all five cross-cutting checks.
2. Separately, authorized **human employee-comprehension reviewers** must decide the same 292 items and all five cross-cutting checks using synthetic or authorized review material, never real employee evaluation data.
3. For every approval, supply the human user ID, reviewer kind, UTC timestamp, exact item ID, English source hash, Arabic content hash, Version `1`, decision, and semantic note.
4. Any unresolved/rejected item, stale hash, machine reviewer, indistinct adjacent anchor, or incomplete cross-cutting check keeps Arabic inactive.

## Cross-cutting review checklist

- [ ] RTL layout reviewed directly by both human reviewer kinds.
- [ ] Mixed Arabic/English terminology reviewed directly by both human reviewer kinds.
- [ ] Gulf Arabic examples reviewed directly by both human reviewer kinds.
- [ ] Levantine Arabic examples reviewed directly by both human reviewer kinds.
- [ ] Every adjacent anchor pair reviewed for distinct meaning by both human reviewer kinds.

## Cross-cutting evidence contracts

- RTL layout: `tests/e2e/rtl-focus.spec.ts`, `tests/e2e/locale-shell.spec.ts`.
- Mixed terminology: `tests/e2e/mixed-direction.spec.ts`, `tests/ai-evals/fixtures/mixed-direction.json`.
- Gulf Arabic synthetic fixtures: `tests/ai-evals/fixtures/gulf-dialect.json`, `tests/ai-evals/fixtures/audio/gulf-synthetic.wav`.
- Levantine Arabic synthetic fixtures: `tests/ai-evals/fixtures/levantine-dialect.json`, `tests/ai-evals/fixtures/audio/levantine-synthetic.wav`.
- Adjacent anchors: the exact complete inventory of 90 stable anchor IDs in `reviewChecks.adjacentAnchors.evidenceRefs`; missing, extra, duplicate, reordered, or whitespace-modified references are rejected.

## Stop package

- Review files: `packages/localization/src/rubric/v1.en.json`, `packages/localization/src/rubric/v1.ar.json`, and this inventory.
- Structural parity: PASS for exact source hash, Version `1`, stable IDs/order, and T010 counts.
- Unresolved semantic items: **292**.
- Unresolved IDs: `section.PPB.title`, `section.ARL.title`, `section.EED.title`, `section.PROJECT-CONTRIBUTION.title`, `PPB-01.title`, `PPB-01.assessmentBasis`, `PPB-01.definition`, `PPB-01.whyItMatters`, `PPB-01.included`, `PPB-01.excluded`, `PPB-01.evidenceGuidance`, `PPB-01.anchor.1`, `PPB-01.anchor.2`, `PPB-01.anchor.3`, `PPB-01.anchor.4`, `PPB-01.anchor.5`, `PPB-01.example.1`, `PPB-01.example.2`, `PPB-01.example.3`, `PPB-01.example.4`, `PPB-01.example.5`, `PPB-02.title`, `PPB-02.assessmentBasis`, `PPB-02.definition`, `PPB-02.whyItMatters`, `PPB-02.included`, `PPB-02.excluded`, `PPB-02.evidenceGuidance`, `PPB-02.anchor.1`, `PPB-02.anchor.2`, `PPB-02.anchor.3`, `PPB-02.anchor.4`, `PPB-02.anchor.5`, `PPB-02.example.1`, `PPB-02.example.2`, `PPB-02.example.3`, `PPB-02.example.4`, `PPB-02.example.5`, `PPB-03.title`, `PPB-03.assessmentBasis`, `PPB-03.definition`, `PPB-03.whyItMatters`, `PPB-03.included`, `PPB-03.excluded`, `PPB-03.evidenceGuidance`, `PPB-03.anchor.1`, `PPB-03.anchor.2`, `PPB-03.anchor.3`, `PPB-03.anchor.4`, `PPB-03.anchor.5`, `PPB-03.example.1`, `PPB-03.example.2`, `PPB-03.example.3`, `PPB-03.example.4`, `PPB-03.example.5`, `PPB-04.title`, `PPB-04.assessmentBasis`, `PPB-04.definition`, `PPB-04.whyItMatters`, `PPB-04.included`, `PPB-04.excluded`, `PPB-04.evidenceGuidance`, `PPB-04.anchor.1`, `PPB-04.anchor.2`, `PPB-04.anchor.3`, `PPB-04.anchor.4`, `PPB-04.anchor.5`, `PPB-04.example.1`, `PPB-04.example.2`, `PPB-04.example.3`, `PPB-04.example.4`, `PPB-04.example.5`, `ARL-01.title`, `ARL-01.assessmentBasis`, `ARL-01.definition`, `ARL-01.whyItMatters`, `ARL-01.included`, `ARL-01.excluded`, `ARL-01.evidenceGuidance`, `ARL-01.anchor.1`, `ARL-01.anchor.2`, `ARL-01.anchor.3`, `ARL-01.anchor.4`, `ARL-01.anchor.5`, `ARL-01.example.1`, `ARL-01.example.2`, `ARL-01.example.3`, `ARL-01.example.4`, `ARL-01.example.5`, `ARL-02.title`, `ARL-02.assessmentBasis`, `ARL-02.definition`, `ARL-02.whyItMatters`, `ARL-02.included`, `ARL-02.excluded`, `ARL-02.evidenceGuidance`, `ARL-02.anchor.1`, `ARL-02.anchor.2`, `ARL-02.anchor.3`, `ARL-02.anchor.4`, `ARL-02.anchor.5`, `ARL-02.example.1`, `ARL-02.example.2`, `ARL-02.example.3`, `ARL-02.example.4`, `ARL-02.example.5`, `ARL-03.title`, `ARL-03.assessmentBasis`, `ARL-03.definition`, `ARL-03.whyItMatters`, `ARL-03.included`, `ARL-03.excluded`, `ARL-03.evidenceGuidance`, `ARL-03.anchor.1`, `ARL-03.anchor.2`, `ARL-03.anchor.3`, `ARL-03.anchor.4`, `ARL-03.anchor.5`, `ARL-03.example.1`, `ARL-03.example.2`, `ARL-03.example.3`, `ARL-03.example.4`, `ARL-03.example.5`, `ARL-04.title`, `ARL-04.assessmentBasis`, `ARL-04.definition`, `ARL-04.whyItMatters`, `ARL-04.included`, `ARL-04.excluded`, `ARL-04.evidenceGuidance`, `ARL-04.anchor.1`, `ARL-04.anchor.2`, `ARL-04.anchor.3`, `ARL-04.anchor.4`, `ARL-04.anchor.5`, `ARL-04.example.1`, `ARL-04.example.2`, `ARL-04.example.3`, `ARL-04.example.4`, `ARL-04.example.5`, `EED-01.title`, `EED-01.assessmentBasis`, `EED-01.definition`, `EED-01.whyItMatters`, `EED-01.included`, `EED-01.excluded`, `EED-01.evidenceGuidance`, `EED-01.anchor.1`, `EED-01.anchor.2`, `EED-01.anchor.3`, `EED-01.anchor.4`, `EED-01.anchor.5`, `EED-01.example.1`, `EED-01.example.2`, `EED-01.example.3`, `EED-01.example.4`, `EED-01.example.5`, `EED-02.title`, `EED-02.assessmentBasis`, `EED-02.definition`, `EED-02.whyItMatters`, `EED-02.included`, `EED-02.excluded`, `EED-02.evidenceGuidance`, `EED-02.anchor.1`, `EED-02.anchor.2`, `EED-02.anchor.3`, `EED-02.anchor.4`, `EED-02.anchor.5`, `EED-02.example.1`, `EED-02.example.2`, `EED-02.example.3`, `EED-02.example.4`, `EED-02.example.5`, `EED-03.title`, `EED-03.assessmentBasis`, `EED-03.definition`, `EED-03.whyItMatters`, `EED-03.included`, `EED-03.excluded`, `EED-03.evidenceGuidance`, `EED-03.anchor.1`, `EED-03.anchor.2`, `EED-03.anchor.3`, `EED-03.anchor.4`, `EED-03.anchor.5`, `EED-03.example.1`, `EED-03.example.2`, `EED-03.example.3`, `EED-03.example.4`, `EED-03.example.5`, `EED-04.title`, `EED-04.assessmentBasis`, `EED-04.definition`, `EED-04.whyItMatters`, `EED-04.included`, `EED-04.excluded`, `EED-04.evidenceGuidance`, `EED-04.anchor.1`, `EED-04.anchor.2`, `EED-04.anchor.3`, `EED-04.anchor.4`, `EED-04.anchor.5`, `EED-04.example.1`, `EED-04.example.2`, `EED-04.example.3`, `EED-04.example.4`, `EED-04.example.5`, `PROJECT-CONTRIBUTION.title`, `PROJECT-CONTRIBUTION.purpose`, `PROJECT-CONTRIBUTION.anchor.1`, `PROJECT-CONTRIBUTION.anchor.2`, `PROJECT-CONTRIBUTION.anchor.3`, `PROJECT-CONTRIBUTION.anchor.4`, `PROJECT-CONTRIBUTION.anchor.5`, `PROJECT-CONTRIBUTION.prohibitedInputs.1`, `PROJECT-CONTRIBUTION.prohibitedInputs.2`, `PROJECT-CONTRIBUTION.prohibitedInputs.3`, `PROJECT-CONTRIBUTION.prohibitedInputs.4`, `PROJECT-CONTRIBUTION.prohibitedInputs.5`, `PROJECT-CONTRIBUTION.prohibitedInputs.6`, `PROJECT-CONTRIBUTION.prohibitedInputs.7`, `PROJECT-CONTRIBUTION.requiredContextReview.1`, `PROJECT-CONTRIBUTION.requiredContextReview.2`, `PROJECT-CONTRIBUTION.requiredContextReview.3`, `PROJECT-CONTRIBUTION.requiredContextReview.4`, `PROJECT-CONTRIBUTION.requiredContextReview.5`, `PROJECT-CONTRIBUTION.requiredContextReview.6`, `PROJECT-CONTRIBUTION.requiredContextReview.7`, `PROJECT-CONTRIBUTION.requiredContextReview.8`, `PROJECT-CONTRIBUTION.requiredContextReview.9`, `PROJECT-CONTRIBUTION.requiredContextReview.10`, `PROJECT-CONTRIBUTION.example.1`, `PROJECT-CONTRIBUTION.example.2`, `PROJECT-CONTRIBUTION.example.3`, `PROJECT-CONTRIBUTION.example.4`, `PROJECT-CONTRIBUTION.example.5`, `MGR-01.title`, `MGR-01.definition`, `MGR-01.anchor.1`, `MGR-01.anchor.2`, `MGR-01.anchor.3`, `MGR-01.anchor.4`, `MGR-01.anchor.5`, `MGR-01.commentPrompt`, `MGR-02.title`, `MGR-02.definition`, `MGR-02.anchor.1`, `MGR-02.anchor.2`, `MGR-02.anchor.3`, `MGR-02.anchor.4`, `MGR-02.anchor.5`, `MGR-02.commentPrompt`, `MGR-03.title`, `MGR-03.definition`, `MGR-03.anchor.1`, `MGR-03.anchor.2`, `MGR-03.anchor.3`, `MGR-03.anchor.4`, `MGR-03.anchor.5`, `MGR-03.commentPrompt`, `MGR-04.title`, `MGR-04.definition`, `MGR-04.anchor.1`, `MGR-04.anchor.2`, `MGR-04.anchor.3`, `MGR-04.anchor.4`, `MGR-04.anchor.5`, `MGR-04.commentPrompt`, `MGR-05.title`, `MGR-05.definition`, `MGR-05.anchor.1`, `MGR-05.anchor.2`, `MGR-05.anchor.3`, `MGR-05.anchor.4`, `MGR-05.anchor.5`, `MGR-05.commentPrompt`, `bias-guidance.1`, `bias-guidance.2`, `bias-guidance.3`, `bias-guidance.4`, `bias-guidance.5`, `bias-guidance.6`, `bias-guidance.7`, `bias-guidance.8`, `bias-guidance.9`, `bias-guidance.10`, `bias-guidance.11`, `bias-guidance.12`, `bias-guidance.13`, `bias-guidance.14`, `bias-guidance.15`
- Cross-cutting checks unresolved: `rtlLayout`, `mixedTerminology`, `gulfArabicExamples`, `levantineArabicExamples`, `adjacentAnchors`.
- No human reviewer identities or timestamps are recorded. No approval, import, persistence, audit, migration, or activation has occurred.

### Verification commands and results

- `node scripts/export-rubric-review.mjs` — **PASS**: exact 292-item unresolved inventory exported.
- `pnpm --filter @evaluation/localization test -- translation-approval` — **PASS**: 3 files, 55 tests.
- `pnpm test:ai` — **PASS**: 2 files, 133 tests; 1 intentional live-provider test skipped.
- T015 regression checks — **PASS**: UI 7 tests, Web 6 tests, production Chromium RTL/locale/mixed-direction 11 tests.
- Full unit, format, lint/copy/boundaries, typecheck, and build — **PASS**: 405 unit tests and 14/14 packages for lint, typecheck, and build.
- Performance-input and secret scans — **PASS**: 127 performance-boundary files and 476 secret-scan files inspected.
- Database import/migration/integration activation commands — **NOT RUN BY DESIGN** before direct human approval.

## Exact semantic inventory

### `section.PPB.title`

- Rubric version: `1`
- Entry kind: `section-title`
- English source: Professional Performance and Workplace Behavior
- English source hash: `15368e26549f049d7bd132ec4be3fe892111af6fe8fee2ebaaed62d27bc49ecc`
- Recommended Arabic draft: الأداء المهني والسلوك في مكان العمل
- Arabic content hash: `b55f83f5cd80f9525988f90bb63575ca0cc82446ae3db6d9c4b30c58a3f1b2e0`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `section.ARL.title`

- Rubric version: `1`
- Entry kind: `section-title`
- English source: AI Research, Learning, and Development
- English source hash: `1ec23e2d7593cc3caa1f9b8866e1d7e3852190c92314b2a572c600ca08ba1d77`
- Recommended Arabic draft: البحث والتعلم والتطوير في مجال الذكاء الاصطناعي
- Arabic content hash: `1a1adafbd8cb6e0e6a2e4b0b1d138e6708419863537eb26a1ababf7a8742a32d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `section.EED.title`

- Rubric version: `1`
- Entry kind: `section-title`
- English source: Engineering, Execution, and Documentation
- English source hash: `ceeebf7149849348a487ea67c15a9063a74e0b8204af51d9ddb208ac44c40532`
- Recommended Arabic draft: الهندسة والتنفيذ والتوثيق
- Arabic content hash: `ad646f6ac7655aee34dd4b700358609243175fbedacd1be8fc9fd81bf88eee9f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `section.PROJECT-CONTRIBUTION.title`

- Rubric version: `1`
- Entry kind: `section-title`
- English source: Project Contribution
- English source hash: `4e65d9d9dcf5e02d08a41c5ab734b267853b02339396f40bb02cfce907a4567f`
- Recommended Arabic draft: المساهمة في المشروع
- Arabic content hash: `bdd309e00dcfbe3ac4230cbeef899ecab93b15d4a2e2dbd992963d9793a15b91`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Responsibility and Reliability
- English source hash: `6275e6cbf6ffab678596c2c2e15a7a74fd187d126782a79d7173a6cf3a1f8127`
- Recommended Arabic draft: المسؤولية والموثوقية
- Arabic content hash: `30f47dec302dd5ae4c2bd55a342995e621f03809711646ac113b7c0da3489823`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Observation-Based + Outcome-Based + Project Records
- English source hash: `ccc5f465e809c0f3d3e97abefb1a05d27b88c48b233576d09cfb89302faf990c`
- Recommended Arabic draft: ملاحظات + نتائج + سجلات المشروع
- Arabic content hash: `29c173f4d1c96c882b8cbb8b2c463a11be5b7945687788f5a05349b7b9e7c1ce`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `PPB-01.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Consistently owns assigned responsibilities, keeps work visible, follows through on commitments, raises blockers early, and protects continuity through clear handover and status management.
- English source hash: `244bd90ce830cf3d19ebfb8ed21e44ecb2c99b2c590da140cd1e4b8cd4ccd4cf`
- Recommended Arabic draft: يتحمل باستمرار المسؤوليات الموكلة إليه، ويحافظ على وضوح العمل المرئي، ويتابع الالتزامات، ويرفع العوائق مبكرًا، ويصون الاستمرارية من خلال تسليم المهام الواضح وإدارة الحالة.
- Arabic content hash: `39171ef64ce42dcc5f94c86dda4a450f2b27514b00bf6bb2a0c98e09152c725f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: The pilot team works with high autonomy and limited task-level supervision. Reliable ownership is necessary for projects to continue without constant managerial intervention.
- English source hash: `18c249fad56a5782fbb14784db95e0307e3a7ff1e8a0f4edd28ff73a76a614d0`
- Recommended Arabic draft: يعمل فريق المشروع التجريبي بدرجة عالية من الاستقلالية وبإشراف محدود على مستوى المهمة. تعد الملكية الموثوقة ضرورية لاستمرار المشاريع دون تدخل إداري مستمر.
- Arabic content hash: `8ba290fd3a495432926fe2de70017c9ee27575bbccae81a0f727994912633fd8`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Follow-through; timely status communication; early blocker escalation; realistic commitments; continuity during leave or reassignment; accountability for decisions within the employee’s responsibility window.
- English source hash: `2dd344d2c8045e292c73ba3b55991f435e81c0302a602cee540879cefdc31f2c`
- Recommended Arabic draft: المتابعة؛ التواصل المنتظم للحالة؛ تصعيد العوائق المبكر؛ الالتزامات الواقعية؛ استمرارية العمل أثناء الإجازة أو إعادة التكليف؛ المساءلة عن القرارات ضمن فترة المسؤولية للموظف.
- Arabic content hash: `8947199f8f646c4f3e0128c675ad8ecb5c5e17a06fdf7b0ca29da98d84edcbd4`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Raw hours worked; always being available; accepting unreasonable workload; project outcomes controlled mainly by clients, data access, or external dependencies; technical quality assessed elsewhere.
- English source hash: `bdfd85c27fe9b61b0cce59baf3fc7a78bf939e1664a79ba11216f5925a2acb89`
- Recommended Arabic draft: عدد الساعات الخام التي عملها؛ التوافر الدائم؛ قبول عبء العمل غير المعقول؛ نتائج المشروع المتحكم بها بشكل رئيسي من قبل العملاء، أو الوصول إلى البيانات، أو التبعيات الخارجية؛ الجودة التقنية المقدرة في مكان آخر.
- Arabic content hash: `ed4dfae28a1bd8743a23090c6541ef39d659a1b9d08b5e6a8ce3d7be1983fe30`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Manager observation; Thursday check-ins; project/workstream status history; handovers; responsibility windows; delivery records; documented blocker escalation.
- English source hash: `7894e4bdf6e3fac5bf429b1990e0cc7ff10416ef00600e464de9f1d5335e3bd3`
- Recommended Arabic draft: ملاحظات المدير؛ اجتماعات المتابعة يوم الخميس؛ تاريخ حالة المشروع/مسار العمل؛ عمليات تسليم المهام؛ فترات المسؤولية؛ سجلات التسليم؛ تصعيد العوائق الموثق.
- Arabic content hash: `3aa4b128f1a5bf8ce9a4ec931df2f5960ffb5a06bbb62d012af24840e7242fbc`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly leaves responsibilities unclear or unattended, misses commitments without early notice, and requires frequent intervention to restore visibility or continuity.
- English source hash: `24c678746ad0946fd964bc00de2e0c7114650db3d3a9055595751a683578c19a`
- Recommended Arabic draft: يترك المسؤوليات بشكل متكرر غامضة أو مهملة، ويفوّت الالتزامات دون إشعار مبكر، ويتطلب تدخلاً متكرراً لاستعادة الوضوح أو الاستمرارية.
- Arabic content hash: `f1d446d4d671cf5a5ddbb7cab5c24a3e92e98f1f396610816fb3604dd436d7d2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-01.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Shows partial ownership but follow-through, status clarity, or blocker escalation is inconsistent and sometimes causes avoidable delay or confusion.
- English source hash: `2f092c97e2f36edf4cbca463a7052d6cc4dffba7c1bb86413e0f7420db15148e`
- Recommended Arabic draft: يظهر ملكية جزئية، لكن المتابعة أو وضوح الحالة أو تصعيد العوائق غير متسق ويسبب أحياناً تأخيرًا أو ارتباكاً يمكن تجنبه.
- Arabic content hash: `b9dfed7d74c2f449152bfb5eeaf974fffa194648c98d40b8738fb359bc276bd8`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-01.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Reliably owns assigned work, communicates status and blockers in time, follows through on commitments, and completes appropriate handovers.
- English source hash: `0b7064739fcfff9f38bbaf8a155901d24de0a6f434c8b5411f0cc6f908365dff`
- Recommended Arabic draft: يتملك بشكل موثوق العمل الموكل إليه، ويتواصل بشأن الحالة والعوائق في الوقت المناسب، ويتابع الالتزامات، ويكمل عمليات تسليم المهام المناسبة.
- Arabic content hash: `62b3069902cf98bed38fc577423361227ac017ea751d24fd147743247a3bc9d3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-01.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Anticipates continuity risks, improves visibility for others, resolves ownership gaps early, and repeatedly makes delivery more dependable beyond their own tasks.
- English source hash: `20e4ad676b2fabf3fb134b76e23adfb00ca5205aa4ce928deec8d1dab384e885`
- Recommended Arabic draft: يتوقع مخاطر الاستمرارية، ويحسن وضوح الرؤية للآخرين، ويزيل فجوات الملكية مبكراً، ويتجاوز بشكل متكرر موثوقية التسليم بما يتجاوز مهامه الخاصة.
- Arabic content hash: `6c71c90d40745d59fd7aaf9697f27b8564c30f07242ca58208cbd98c866e424c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-01.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates a sustained standard of ownership that materially improves team reliability, prevents recurring operational failure, and strengthens continuity across multiple projects or workstreams.
- English source hash: `83e17551c52f2d171d86cca999707fbd41da3074f31a969e1de9f3f909962139`
- Recommended Arabic draft: يخلق معياراً مستداماً للملكية يحسن بصورة جوهرية من موثوقية الفريق، ويمنع فشل التشغيل المتكرر، ويعزز الاستمرارية عبر مشاريع أو مسارات عمل متعددة.
- Arabic content hash: `fbe7b032a4a4430e50871c15341801fe81558577bf5b50cadfe6ef5fc8158800`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-01.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Keeps project status current, raises a data dependency before it blocks the team, and completes a usable handover before leave.
- English source hash: `7ead47f5569dab8e34f087eb4b187edd59d75df734fa462b884f73dac27e3e84`
- Recommended Arabic draft: التقييم 3: يحافظ على تحديث حالة المشروع، ويرفع تبعية البيانات قبل أن تعيق الفريق، ويكمل عملية تسليم مهام قابلة للاستخدام قبل الإجازة.
- Arabic content hash: `a84314064f2ae54ab2460041df4b72f1d9c6ef4ae6dcf3320975b6a18d1e60a1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Revises an expected completion date with a clear reason and next step rather than allowing the date to become silently outdated.
- English source hash: `7905823dd5943a73a65124bb0fce3c8afadbb16b905dd59dfa785635a79da7a0`
- Recommended Arabic draft: التقييم 3: يعدل تاريخ الاكتمال المتوقع لسبب واضح وخطوة تالية بدلاً من ترك التاريخ قديماً بصمت.
- Arabic content hash: `300190ec7a16ddd2dd169799c8812f6bdd91f2ad82c40712e4fe4b8e40281ac2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Detects that ownership between two workstreams is unclear and coordinates a documented resolution before integration is affected.
- English source hash: `d66d1be7e1c17f985cabaef182b9f7877ebdc74cd953c6489a7ad0dcc45fc7f4`
- Recommended Arabic draft: التقييم 4: يكتشف أن الملكية بين مساري عمل اثنين غير واضحة وينسق حلاً موثقاً قبل تأثر عملية التكامل.
- Arabic content hash: `7707ad3433d792efed840c7f3a0797baee74d8db6f7ac006fd7a725faa6ff0ce`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Establishes a repeatable continuity practice that is adopted across the department and measurably reduces stalled or ownerless work.
- English source hash: `f073204234a46b1d967f738fcf94cda7626513722fd3929a81d8e79c92b2ad9d`
- Recommended Arabic draft: التقييم 5: يؤسس ممارسة استمرارية قابلة للتكرار يتم تبنيها عبر القسم ويقلل بشكل قابل للقياس من العمل المتوقف أو الذي لا مالك له.
- Arabic content hash: `2d73e69a7f2d1cb9eb6bad69f382561f6f593de255df4f141fb3c2696192bc71`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-01.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Working late or responding instantly does not by itself demonstrate reliability if commitments, status, and handovers remain unclear.
- English source hash: `f54015bba914872dc79676425b86ca18bd9231aa1820f87fc0d4053482eae6c5`
- Recommended Arabic draft: مثال مضاد: العمل لوقت متأخر أو الرد الفوري لا يثبت الموثوقية بحد ذاته إذا ظلت الالتزامات والحالة والتسليمات غير واضحة.
- Arabic content hash: `6c33eecfac5ab13b459536c55552592a2810848cca0b2f40bf0c5c8597ec1262`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Collaboration and Knowledge Sharing
- English source hash: `d597f041d17ed4c1f786b7bb38cffc8566f166130bdaba6523241337b104a53a`
- Recommended Arabic draft: التعاون وتبادل المعرفة
- Arabic content hash: `80c227d5e27ea067884df08bd1f5a15eb78ba59ca2ecf18874e83323afd71844`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Observation-Based + Peer/Project Records + Mixed
- English source hash: `6195df1f613f864fc7914298c83c07de19f3fc638f3a43df3a788895605ea292`
- Recommended Arabic draft: ملاحظات + سجلات الزملاء/المشروع + مختلط
- Arabic content hash: `8d4348d92feb25575af0ef00672b8670dd40e487cf91d06b5100bf603295df8e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `PPB-02.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Contributes constructively to shared work, supports colleagues, represents contribution fairly, and transfers useful knowledge so the team can progress without unnecessary dependency on one person.
- English source hash: `195c8e3e63e5a2eaad2021118b76f0af1a12f2f1fb4912e03ef55f6734069950`
- Recommended Arabic draft: يساهم بشكل بناء في العمل المشترك، ويدعم الزملاء، ويمثل المساهمة بإنصاف، وينقل المعرفة المفيدة حتى يتمكن الفريق من التقدم دون اعتماد غير ضروري على شخص واحد.
- Arabic content hash: `f5dec2116c16603d5c2094d79bff95fe4debf61d9b0dfd81124d138dac5e72d4`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: Projects and workstreams are collaborative, responsibilities may overlap, and knowledge must survive delegation, leave, and changing ownership.
- English source hash: `79285a8a48e3f1cb7256477da4c2b5b9624d603e6a2edb2288bc31009884b05b`
- Recommended Arabic draft: المشاريع ومسارات العمل تعاونية، وقد تتداخل المسؤوليات، ويجب أن تنجو المعرفة من التفويض والإجازات وتغير الملكية.
- Arabic content hash: `16c75ce1d9731e79b1fccf9ec49236b79906614323295236405bf40a6658e398`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Practical support; constructive review; shared problem solving; fair attribution; knowledge transfer; usable explanations; participation in joint decisions.
- English source hash: `e7a872e2e2bb1b3bf2437ead3d7d78c7357e61c2958a4923199c02433b128b0f`
- Recommended Arabic draft: الدعم العملي؛ المراجعة البناءة؛ حل المشكلات المشترك؛ الإسناد العادل؛ نقل المعرفة؛ الشروحات القابلة للاستخدام؛ المشاركة في القرارات المشتركة.
- Arabic content hash: `18734a74664519924a3727a168a4378da79e19a390ebd7f8ce88715cfa4f3b98`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Popularity; sociability; being talkative; doing another employee’s work permanently; technical documentation quality assessed under EED-04.
- English source hash: `a747413447ce06105b32b6da6ff869c7468354ecf392a01d0130bcafa8372bcc`
- Recommended Arabic draft: الشعبية؛ الاجتماعية؛ كثرة الكلام؛ القيام بعمل موظف آخر بشكل دائم؛ جودة التوثيق التقني المقدرة تحت EED-04.
- Arabic content hash: `37a23dbe91d3437acf52d031d934d36b6961eb1d7a157a433d5b6fbe62cbd54e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Manager observation; shared updates; peer acknowledgment; review comments; handover quality; learning sessions; contribution records; reusable guides.
- English source hash: `364b33e0174e2a50ccc5aeaeb084315e345e08cbdba92e0f941593c89124383f`
- Recommended Arabic draft: ملاحظات المدير؛ التحديثات المشتركة؛ اعتراف الزملاء؛ تعليقات المراجعة؛ جودة تسليم المهام؛ جلسات التعلم؛ سجلات المساهمة؛ الأدلة القابلة لإعادة الاستخدام.
- Arabic content hash: `101e4f3b0cc1b9e8beeb8a833344f3be72d064b3dd4f42dfbf925f5a8aa86b92`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly withholds needed context, creates avoidable friction, misrepresents shared contribution, or makes collaboration materially harder.
- English source hash: `631c7dc313d8a4af65f94c21bdec997cdc41b9737e6f8fc45835908cc9448737`
- Recommended Arabic draft: يحجب باستمرار السياق المطلوب، ويخلق احتكاكاً يمكن تجنبه، ويمثل المساهمة المشتركة بشكل خاطئ، أو يجعل التعاون أصعب بصورة جوهرية.
- Arabic content hash: `20323f47f7e734044610d7e1b2d96c9eed73dacfeeb06e2612c9976f0d79fb2b`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-02.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Cooperates when directed but support, knowledge sharing, or contribution clarity is inconsistent and others often need to reconstruct missing context.
- English source hash: `749418fda5efc11bd525f8dcae72d83207723ed1c2757a2a524112ad7496a517`
- Recommended Arabic draft: يتعاون عند التوجيه ولكن الدعم أو مشاركة المعرفة أو وضوح المساهمة غير متسق وغالباً ما يحتاج الآخرون إلى إعادة بناء السياق المفقود.
- Arabic content hash: `3dff57911a28e93669458ec1ad24297abe8bccabb82f7384a0d86081f207b803`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-02.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Works constructively with colleagues, shares relevant knowledge, supports joint work, and represents individual and team contributions fairly.
- English source hash: `4e1649129a40993d5eda71fa7dc51df0dad70c1cee3c1c8e69d5b1629414b03f`
- Recommended Arabic draft: يعمل بشكل بناء مع الزملاء، ويشارك المعرفة ذات الصلة، ويدعم العمل المشترك، ويمثل مساهمات الفرد والفريق بإنصاف.
- Arabic content hash: `3cac922beab81097903081295f11e567e3c6741ff8c64b1733b31cc36ce00c94`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-02.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Proactively removes collaboration barriers, improves shared understanding, and repeatedly helps others become more capable or independent.
- English source hash: `795249a74b22a3c487384473b7f0ff07c6a48e577d5856c704a40f3a45dcde55`
- Recommended Arabic draft: يزيل بشكل استباقي حواجز التعاون، ويحسن التفاهم المشترك، ويساعد الآخرين بشكل متكرر ليصبحوا أكثر قدرة أو استقلالية.
- Arabic content hash: `911d2a1bd43ebfd1fbc760d6aaeffa5956322d36ab5767d512ffa96fa34d4868`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-02.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates sustained team-wide capability through exceptional knowledge transfer, fair collaboration practices, and reusable methods that materially improve collective performance.
- English source hash: `f17de5f63b449abc6886e7d7e1137b2b14080dba7255e66215843d919751e3be`
- Recommended Arabic draft: يخلق قدرة مستدامة على مستوى الفريق من خلال نقل المعرفة الاستثنائي، وممارسات التعاون العادلة، والأساليب القابلة لإعادة الاستخدام التي تحسن بصورة جوهرية الأداء الجماعي.
- Arabic content hash: `10cf2024b583fc86a76cc5d83ce78a15d654c6b3d6764baa307e6176540536b5`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-02.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Reviews a colleague’s approach, explains a risk clearly, and records the joint decision without claiming sole credit.
- English source hash: `245c79ae3283653c4deb4cbcf1d15eb7d019c246750b18aa1f2cd2c2ebcae11c`
- Recommended Arabic draft: التقييم 3: يراجع منهج زميل، ويشرح خطراً بوضوح، ويسجل القرار المشترك دون المطالبة بالفضل وحده.
- Arabic content hash: `81d96496d796efe66e83cb921a990c25871e85105e61727a5bd9775493204e38`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Shares a tested setup or lesson that allows another contributor to continue the work.
- English source hash: `1e9e48e8ffe574b7bdd96e220ce5f66fc9c77452ee921a91442a5fd9fd408c2a`
- Recommended Arabic draft: التقييم 3: يشارك إعداداً أو درساً تم اختباره يسمح لمساهم آخر بمواصلة العمل.
- Arabic content hash: `66b05307147a6d44e8eed3eb5296a73b420d7e871a9662eea9b06c93bb24b27f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Converts repeated individual questions into a reusable team guide and helps colleagues apply it.
- English source hash: `11291fdb925c6f13a61d47b962d562679d48389cbd85fe282cb98a986fb6dff0`
- Recommended Arabic draft: التقييم 4: يحول الأسئلة الفردية المتكررة إلى دليل فريق قابل لإعادة الاستخدام ويساعد الزملاء على تطبيقه.
- Arabic content hash: `eb75703b302f59ad239a609fc5b2d7303bd90eb5861b5e72529333c59c8e49b3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Builds a sustained knowledge-sharing practice that reduces dependency on individuals across several projects.
- English source hash: `eee9db76c9043cc2d53cf03c389cf06ebc6947303578585c755c58baa73570a1`
- Recommended Arabic draft: التقييم 5: يبني ممارسة مستدامة لمشاركة المعرفة تقلل الاعتماد على الأفراد عبر عدة مشاريع.
- Arabic content hash: `7fbdf467902b08223c379bcceae1fdd73e8b41cf6d6e80d13b2b2f4948c3ce45`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-02.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Attending meetings or frequently commenting does not by itself demonstrate meaningful collaboration.
- English source hash: `2290f4308052c1970f31308753f4307c0499e8032816d1eab671a7dbf19decfb`
- Recommended Arabic draft: مثال مضاد: حضور الاجتماعات أو التعليق بشكل متكرر لا يثبت بالضرورة تعاوناً ذا مغزى.
- Arabic content hash: `cb6f04a2c33dc8c4c8eb1373a44e0e71d8cd1953685c42d8ad6597c8c672ebac`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Communication and Professional Conduct
- English source hash: `2a5db73fa96a06f82325bfbe7f99d31f871be0915b3bf9878fed09727f3c8d36`
- Recommended Arabic draft: التواصل والسلوك المهني
- Arabic content hash: `dfec2c64b5f3058ddf20885f7aa816ee0f59a773053a3c6251737cb8f9de022a`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Observation-Based
- English source hash: `495fccab482a89351f6c5a641365669218a21a3fd5cdd1adacaa0758059d812b`
- Recommended Arabic draft: ملاحظات المراقبة
- Arabic content hash: `f9c4d377c811338d24dd9d7edacc38b01830397f558b20349efc8cc2e0f75827`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `PPB-03.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Communicates work-relevant information clearly, respectfully, and at the appropriate time; handles disagreement and feedback professionally; and makes risks, decisions, and expectations understandable to relevant people.
- English source hash: `ea374f4117d52ecb9bfe1caa99a6fbb7d23a96a03b6a50d024a10af83188c97e`
- Recommended Arabic draft: يتواصل بشأن المعلومات ذات الصلة بالعمل بوضوح، وباحترام، وفي الوقت المناسب؛ ويتعامل مع الخلاف والملاحظات باحترافية؛ ويجعل المخاطر والقرارات والتوقعات مفهومة للأشخاص المعنيين.
- Arabic content hash: `bffcbfde073f170d47663f7b0d3637f5c239a852853d25d665577da58f412fc5`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: The manager is not expected to direct every technical task, so clarity and professional exchange are essential for informed decisions and coordination.
- English source hash: `448dd157c7082ecf18db24fa73e72629b2fbbdb335a6643281368a679fccd2c0`
- Recommended Arabic draft: لا يتوقع من المدير توجيه كل مهمة تقنية، لذا فإن الوضوح والتبادل المهني ضروريان لاتخاذ قرارات مستنيرة وتنسيق العمل.
- Arabic content hash: `88054ebe3ec30f0fa27f25b151eac223d5d0dfe90a93db86f7aec0146c113357`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Clear explanation; timely communication; respectful disagreement; active listening; appropriate feedback; accurate representation of uncertainty and risk.
- English source hash: `fbf9b454e75623e09ffa8b7a4900fe345a64402ee15042d4f4a020f70d259c4f`
- Recommended Arabic draft: الشرح الواضح؛ التواصل في الوقت المناسب؛ الخلاف باحترام؛ الاستماع النشط؛ الملاحظات المناسبة؛ التمثيل الدقيق للشك وعدم اليقين والمخاطر.
- Arabic content hash: `8b0aaad8f118a0eaf183fdc1100b69a9a7fe570af8b0e43e9934fba46eebb74d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Extroversion; friendliness as personality; smiling; avoiding all disagreement; presentation polish unrelated to work; durable technical documentation assessed under EED-04.
- English source hash: `7ba02a46e41565df7abb646f2e005f7f6ec882f0a51576097424b4c550ebf14e`
- Recommended Arabic draft: الانبساطية؛ الود كشخصية؛ الابتسام؛ تجنب كل خلاف؛ صقل العروض التقديمية غير المتعلق بالعمل؛ التوثيق التقني المستدام المقدر تحت EED-04.
- Arabic content hash: `b9eff4df4cfe4610e6248700e41b338448bb6eda92c21456b2d0c7c310ac5bc2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Manager observation; meeting outcomes; decision records; stakeholder communication; discussion notes; feedback interactions.
- English source hash: `2843dbcfd78bb319b2e7fe98fd00b326ebdcd4de62d13eb33b8b78672179323d`
- Recommended Arabic draft: ملاحظات المدير؛ نتائج الاجتماعات؛ سجلات القرارات؛ تواصل أصحاب المصلحة؛ ملاحظات المناقشة؛ تفاعلات الملاحظات.
- Arabic content hash: `2af64f388e9fb1d434e9613e2a3a05bc65afb13a8fdd2ed5b75ba7acef5b7e52`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Communication is repeatedly unclear, late, disrespectful, or misleading, causing avoidable misunderstanding, conflict, or poor decisions.
- English source hash: `2824eb91d7bf2b42399049812bb675f72a0ad6e81f38c4b23ad3a22770f06710`
- Recommended Arabic draft: التواصل غامض أو متأخر أو غير محترم بشكل متكرر، مما يسبب سوء فهم أو صراعاً أو قرارات سيئة يمكن تجنبها.
- Arabic content hash: `a9bee6f277dc81a89dea3805b9517511cc9f8f98eadfeb0fca39ebba5685c2ec`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-03.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Communicates basic information but clarity, timing, listening, or professional handling of disagreement is inconsistent in important situations.
- English source hash: `55f1da23e26ff73f13c2451faac3ccb8ebfd164e09829e46316d337bedf9336f`
- Recommended Arabic draft: يتواصل بشأن المعلومات الأساسية ولكن الوضوح أو التوقيت أو الاستماع أو التعامل المهني مع الخلاف غير متسق في المواقف المهمة.
- Arabic content hash: `5472175961e65e781f51cd2b566aa6ed1da64066cfaa5e46d994c3d9ec9f582c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-03.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Communicates clearly and respectfully, raises relevant information in time, listens to others, and handles feedback and disagreement professionally.
- English source hash: `98702f841e539ecd127ddf857fe3627e9898afdd0b0b6c42d4cb32cad78053ba`
- Recommended Arabic draft: يتواصل بوضوح واحترام، ويرفع المعلومات ذات الصلة في الوقت المناسب، ويستمع للآخرين، ويتعامل مع الملاحظات والخلاف باحترافية.
- Arabic content hash: `891d7172249b7b5aa9143cdc0573b604ebe0ac9f049a24ab974a6f5a0252aa14`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-03.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Adapts communication effectively to technical and non-technical audiences, surfaces difficult issues constructively, and repeatedly improves shared decisions.
- English source hash: `0235bc6e33ceaccd64b43f490a0af4c26570afcb28c2b02438ff06d28928169e`
- Recommended Arabic draft: يعدل التواصل بشكل فعال ليناسب الجماهير التقنية وغير التقنية، ويكشف القضايا الصعبة بشكل بناء، ويحسن باستمرار القرارات المشتركة.
- Arabic content hash: `65b7da9957e4793996207c85cdafc894b4ae1c36e8810fc8f2213e90e77d806e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-03.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional clarity and trust across complex situations, enabling difficult decisions, resolving recurring communication failure, and strengthening professional team norms.
- English source hash: `e2c4d317a1630c6dc88ec776a414443aa262cb77f1e0b9ec5af8d877aa5be56c`
- Recommended Arabic draft: يخلق وضوحاً وثقة استثنائيتين عبر المواقف المعقدة، مما يتيح اتخاذ قرارات صعبة، وحل فشل التواصل المتكرر، وتقوية المعايير المهنية للفريق.
- Arabic content hash: `8080664134e34dad88078bb55a3951259f0e5357be951e87233a0ed15a2f5085`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-03.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Explains why a model result is preliminary and separates facts from assumptions before a decision is made.
- English source hash: `ff208ff7ed9db17970c26dd71b9458e2227446352ddd9fc8ec5f90262caeff96`
- Recommended Arabic draft: التقييم 3: يشرح سبب كون نتيجة النموذج أولية ويفصل الحقائق عن الافتراضات قبل اتخاذ قرار.
- Arabic content hash: `af9d8dc2c78a7b5dba8816b607c963f8460a0abc9b33dd5d9dc326e018bf6609`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Disagrees with an approach respectfully and provides a clear alternative.
- English source hash: `981c83b3b5593f6c123274ea800aec606d08bc9e4040d43cc63d28cf335e0522`
- Recommended Arabic draft: التقييم 3: يختلف باحترام مع منهج معين ويقدم بديلاً واضحاً.
- Arabic content hash: `957f1e96a112f3aac10167b55be5806acd372e6b938a3ce1fd398214df6845bf`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Translates a complex technical risk into an actionable decision for a non-technical stakeholder.
- English source hash: `30157a87bf339d1f078188656965f99aed3cf5668b2320e02b3fe49cb6a9e7d6`
- Recommended Arabic draft: التقييم 4: يترجم خطراً تقنياً معقداً إلى قرار قابل للتنفيذ لصاحب مصلحة غير تقني.
- Arabic content hash: `8cdee186f534cf01af387f3a601853a6571ddbf7b2f3c7103a31787013277d77`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Establishes a communication approach that materially improves alignment across the department and external stakeholders.
- English source hash: `d066c74f40ba817599f6831d106ff7e8ff8a30a99651f45554594609ebda2050`
- Recommended Arabic draft: التقييم 5: يؤسس نهج تواصل يحسن بصورة جوهرية التوافق عبر القسم وأصحاب المصلحة الخارجيين.
- Arabic content hash: `7523973e65227b8ce81436f4517e1bf71593e6e30304a26fb0837200b3ca0b44`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-03.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Being agreeable or avoiding conflict is not automatically strong professional communication.
- English source hash: `db1237ae71ceb304598434596b0b318020b9219691d6f2b37c720e84e13815ef`
- Recommended Arabic draft: مثال مضاد: أن يكون متفقاً أو يتجنب الصراع لا يمثل تلقائياً تواصلاً مهنياً قوياً.
- Arabic content hash: `d5e628e4e82fdb225d980213975410745c7fc896de0b06b4afd773a0e5079578`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Initiative and Adaptability
- English source hash: `8f3a723c015ebb4f90480e1b4ec9f6505f41d2fb03f59742f7a3a390656ec12c`
- Recommended Arabic draft: المبادرة والقدرة على التكيف
- Arabic content hash: `7e8b01c1eee46c22f52a184b929091e75f9fa20fb7146e1bc53765246ff43e95`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Observation-Based + Outcome-Based
- English source hash: `a3c1f0ac642e8891992ffeb2942974b65de41c311455cd94b6d9a7970a2a6f17`
- Recommended Arabic draft: ملاحظات + نتائج
- Arabic content hash: `c60225634189bac04bd9e172f35758e714f764fce9fbc1c89d5c65349b4616d5`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `PPB-04.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Moves work forward without waiting for detailed technical instructions, identifies useful next steps, and adapts direction responsibly when priorities, evidence, or constraints change.
- English source hash: `e27cf074315d13ed90390d082a4f349a7aea39ebb80ef26ec4f03858d188f7cc`
- Recommended Arabic draft: يُقدم العمل إلى الأمام دون انتظار تعليمات تقنية مفصلة، ويحدد الخطوات التالية المفيدة، ويتكيف مع الاتجاه بمسؤولية عندما تتغير الأولويات أو الأدلة أو القيود.
- Arabic content hash: `148fcb82372de1bee552611b766cdbcea4ebd9862315edd7c6970405b69be502`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: The department operates through broad product and POC direction rather than detailed task assignment, and AI technology changes rapidly.
- English source hash: `b0b7bd5182653a160273b585305879810eed071e37ead584d812c4a657386e0c`
- Recommended Arabic draft: يعمل القسم من خلال اتجاه المنتج ومجالات POC الواسعة بدلاً من تعيين المهام التفصيلية، وتتغير تكنولوجيا الذكاء الاصطناعي بسرعة.
- Arabic content hash: `0a512f89b9fb2c37b3dadbf5febafcaaa167c9884c8d59a074e13450545a8ae0`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Self-directed next steps; useful proposals; responsible experimentation; adapting to new evidence; reprioritization; recovery from changed assumptions.
- English source hash: `2170ad41d41fe2d7c45de1fe3dceff6233493d27e744468e2a947b629d37afd7`
- Recommended Arabic draft: الخطوات التالية الموجهة ذاتياً؛ المقترحات المفيدة؛ التجريب المسؤول؛ التكيف مع الأدلة الجديدة؛ إعادة تحديد الأولويات؛ التعافي من الافتراضات المتغيرة.
- Arabic content hash: `1fddcbf03ebddeb9b4d01a6f3805f2b73b2cd9d2d741d363551fd8e1d945bcc6`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Uncoordinated activity; changing direction without reason; research quality assessed in Section 2; solution quality assessed in Section 3.
- English source hash: `7d11d67189f4b50201f58b9c20a534e9f71114e1b61408830d7bc23759f7ac14`
- Recommended Arabic draft: النشاط غير المنسق؛ تغيير الاتجاه بدون سبب؛ جودة البحث المقدرة في القسم 2؛ جودة الحل المقدرة في القسم 3.
- Arabic content hash: `a0c0e914d32bd6ceb1b092d1ff15106eb40a3bc9a146dc42cd62acd778da0b55`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Manager observation; proposed approaches; project decisions; priority changes; coaching history; project/workstream timelines.
- English source hash: `69044a839b8a85501819f58526d5915d1abd65144838c809f0290b2887a076f5`
- Recommended Arabic draft: ملاحظات المدير؛ المقاربات المقترحة؛ قرارات المشروع؛ تغيير الأولويات؛ تاريخ التدريب؛ الجداول الزمنية للمشروع/مسار العمل.
- Arabic content hash: `2612abbc2593bfd3ac6dfa2e5744e10c048baa0220350831aa8368fae102f990`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Frequently waits for detailed direction, continues an unsuitable path despite clear signals, or initiates uncoordinated work that creates avoidable disruption.
- English source hash: `10746b02d4648ed084947ec79b2af253648b1e12034259c2b087ae6865ae3f9f`
- Recommended Arabic draft: ينتظر بشكل متكرر التوجيه المفصل، ويستمر في مسار غير مناسب رغم الإشارات الواضحة، أو يبادر بعمل غير منسق يسبب اضطراباً يمكن تجنبه.
- Arabic content hash: `b109a7b95117b0b4fe5ba841a5d2eacbd755de1fea7cd1b7096d27f17e012aa6`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-04.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Shows initiative in familiar situations but often needs prompting to define next steps or adapt when priorities and evidence change.
- English source hash: `8343672a9eb3f4dd93810e3ab1b97c888bc7af303bab7c0c2abe4230aa7902a5`
- Recommended Arabic draft: يظهر المبادرة في المواقف المألوفة ولكنه غالباً ما يحتاج إلى تحفيز لتحديد الخطوات التالية أو التكيف عندما تتغير الأولويات والأدلة.
- Arabic content hash: `8f399daae207851b18aac638e47ce1ee4fb78f62eebbc8af0eb5e2e74e9f15d1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-04.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Independently identifies appropriate next steps, proposes useful options, and adapts responsibly to changing priorities or information.
- English source hash: `74190a4c92742cd5b571a52c940472ae33b8e89dba08e9b1017683b80b742719`
- Recommended Arabic draft: يحدد بشكل مستقل الخطوات التالية المناسبة، ويقترح خيارات مفيدة، ويتكيف بمسؤولية مع أولويات أو معلومات متغيرة.
- Arabic content hash: `98e0c4484591d41326fb1e409525265d7212ea29ba65c87d9f611b161be8aad5`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-04.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly anticipates useful opportunities or risks, redirects work with sound reasoning, and helps projects adapt faster without losing control.
- English source hash: `48786a0acdcdcc4efe6c4ee2a1fb6872ee570315d286ef3ddb036c769d0eca11`
- Recommended Arabic draft: يتوقع باستمرار فرصاً أو مخاطر مفيدة، ويعيد توجيه العمل بمنطق سليم، ويساعد المشاريع على التكيف بشكل أسرع دون فقدان السيطرة.
- Arabic content hash: `31270b02ac230e6269f3b456a673e89b72c3a0cc042de86d4a34dd92416bba95`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-04.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Consistently turns ambiguity and change into high-value direction that materially improves multiple projects, team methods, or product opportunities.
- English source hash: `c161e895b9af3d853d580c0ee265b37f7b09403610e340306b2d7c5282494fa8`
- Recommended Arabic draft: يحول باستمرار الغموض والتغيير إلى اتجاه عالي القيمة يحسن بصورة جوهرية عدة مشاريع أو طرق عمل الفريق أو فرص المنتج.
- Arabic content hash: `009fc944d31979585eb4b746447bb8adedaba77381a82fa5389cf82f38c2c78d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PPB-04.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Receives a broad POC objective, identifies the next research and implementation steps, and adjusts after early test results.
- English source hash: `617053a391cf4720e590e8fffd435f81411b4808c5c2cfb5c4739ce61ce0834f`
- Recommended Arabic draft: التقييم 3: يتلقى هدف POC واسع النطاق، ويحدد خطوات البحث والتنفيذ التالية، ويعدل بعد نتائج الاختبار المبكرة.
- Arabic content hash: `5f3e5f36ded3882f9aa4e1e52f5dd9cd4f30185729969cb224110847043676f2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Changes a plan when a dependency fails and documents the reason and new path.
- English source hash: `482e7bdfb1f7f0655c1869e76751bd116630a5487bd2541afc3e22c6bb2d195c`
- Recommended Arabic draft: التقييم 3: يغير خطة عندما يفشل اعتماد ما ويوثق السبب والمسار الجديد.
- Arabic content hash: `34fa15e9d90a63da4567451be3b6837f4d3fc3e51f6d65c0ecddeac4bb3ad8ea`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Anticipates a likely integration problem and validates an alternative before it blocks delivery.
- English source hash: `9213ce15a3007cabc6fd6da95dca7fbb399c42961851e93bcb8fdc54c2910d45`
- Recommended Arabic draft: التقييم 4: يتوقع مشكلة تكامل محتملة ويتحقق من بديل قبل أن يعيق التسليم.
- Arabic content hash: `e5af17f67653f14c7cfc7660cc88655feeb69323396cf1da63dae14df0e1b71a`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Identifies and develops a new reusable product capability that becomes valuable across several client contexts.
- English source hash: `ce9f9eaba5a5fbecee705677e1fee0476f69012a3bb1f77d343b18869779f937`
- Recommended Arabic draft: التقييم 5: يحدد ويطور قدرة منتج قابلة لإعادة الاستخدام تصبح ذات قيمة عبر عدة سياقات للعملاء.
- Arabic content hash: `0abaa565d742eaee6bdf821d9c795cc5b42e4e714dabfae7b4d9b70f4b96564c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PPB-04.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Starting many ideas without finishing, validating, or coordinating them is not strong initiative.
- English source hash: `332fa2421538f727aeec7b4367bebfb3cbfa86560ea80def74461b9c0592f64c`
- Recommended Arabic draft: مثال مضاد: بدء العديد من الأفكار دون إنهاءها أو التحقق منها أو تنسيقها لا يمثل مبادرة قوية.
- Arabic content hash: `01de9be059dd5a0ff92aa4141279fb1661407b86a70cb201f73f92a94c96ef99`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Problem and Hypothesis Formulation
- English source hash: `04b94299a32f447f4b00dee4a99d8c320b0cf46a2aefd4879f98b02e0133a2a9`
- Recommended Arabic draft: صياغة المشكلة والفرضية
- Arabic content hash: `50dda39e0610de20f27321f6bd0995d34c0cf247d915df592b1aebede6c16b72`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Artifact-Based + Mixed
- English source hash: `02c5838617499be102e68accac4ac2c7404c17b18b56a71a93e070608823392d`
- Recommended Arabic draft: مستندات + مختلط
- Arabic content hash: `f8e13048243e9c4f061fc321ab3c0cf984e5724492865734ab0d559684e90c9e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `ARL-01.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Transforms an unclear need into a well-framed technical or research problem with explicit objectives, assumptions, constraints, and testable questions.
- English source hash: `e01229d4d006306ac6b6ec0119d113e9f1e1927f636d8994946b0ff6d939b755`
- Recommended Arabic draft: يحول حاجة غير واضحة إلى مشكلة تقنية أو بحثية مؤطرة جيداً بأهداف وافتراضات وقيود وأسئلة قابلة للاختبار بشكل صريح.
- Arabic content hash: `e4a1de4ea46f9f998ee82aed806923d2145461edb4d97825f293aa1a806ac7be`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: AI work often begins with ambiguous product or client direction. Poor framing produces wasted research, misleading experiments, and unsuitable solutions.
- English source hash: `f413486546c46cc701864fc87d423494a32e2b13b3b51bd54533c64b6c2d06d6`
- Recommended Arabic draft: غالباً ما يبدأ عمل الذكاء الاصطناعي بتوجيه منتج أو عميل غامض. تؤدي الصياغة الضعيفة إلى بحث ضائع، وتجارب مضللة، وحلول غير مناسبة.
- Arabic content hash: `68482805dfd7f70d81423e471533f6eb8175594932ae701c08777c0c89b24d64`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Problem definition; user or business context; hypothesis; assumptions; constraints; success question; uncertainty identification.
- English source hash: `b4251c317a08a9362d8ee00e029445fdb09eaf500d75cc212786161724dc4242`
- Recommended Arabic draft: تحديد المشكلة؛ سياق المستخدم أو العمل التجاري؛ الفرضية؛ الافتراضات؛ القيود؛ سؤال النجاح؛ تحديد عدم اليقين.
- Arabic content hash: `731d05861985605f06e9dbe67fb01d03ef4ae9ed2f2491ce74e9b09a751435bd`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Full project success criteria; final architecture; experiment execution; generic restatement of a client request.
- English source hash: `d56d6c54103b403df4405d5601f4b878022ed72922e84b49d3984f7b1158f89d`
- Recommended Arabic draft: معايير نجاح المشروع الكاملة؛ البنية النهائية؛ تنفيذ التجربة؛ إعادة صياغة عامة لطلب العميل.
- Arabic content hash: `53afce2201d73fcaf94de7e7e794ea36a4fe59a6c8a7cedf7cb6fc2bfec7d219`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Project/workstream documents; research questions; hypothesis records; decision notes; experiment plans; clarification updates.
- English source hash: `f578de1a413ee6001ad554d9ed979fb06fdc9bc4f33de58e0ab8670586d8199e`
- Recommended Arabic draft: مستندات المشروع/مسار العمل؛ أسئلة البحث؛ سجلات الفرضيات؛ ملاحظات القرار؛ خطط التجربة؛ تحديثات التوضيح.
- Arabic content hash: `681d68505097538fa5574d86535ed8483961e790624a7ee8c33f08c725287920`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Regularly begins work without a clear problem, objective, or testable question, leading to irrelevant research or results that cannot support a decision.
- English source hash: `32cd9367f7be280ca3c563348c3ecaa3b7eed2d04aceb5a52f9b36a0ace84beb`
- Recommended Arabic draft: يبدأ العمل بانتظام دون مشكلة أو هدف واضح، أو سؤال قابل للاختبار، مما يؤدي إلى بحث غير ذي صلة أو نتائج لا يمكنها دعم قرار.
- Arabic content hash: `6685ceb1d4d37ec33dac1452cba1705cfb91a84fb550279af54c9c40e86046e5`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-01.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Identifies the general problem but important assumptions, constraints, or hypotheses remain unclear and require substantial correction.
- English source hash: `662afb4cc0658387fb918546437b11dd5514687393b786fd455097361ef516fa`
- Recommended Arabic draft: يحدد المشكلة العامة ولكن الافتراضات أو القيود أو الفرضيات المهمة تظل غير واضحة وتتطلب تصحيحاً كبيراً.
- Arabic content hash: `88fff8404bc6c8bcc9d9d448c5c36933db7e5da8143e7358c2107e6a3ea4d988`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-01.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Frames the problem adequately, identifies relevant assumptions and constraints, and defines questions that can guide research or testing.
- English source hash: `78b2bf76d0f56e2b87a9ea59c837c59020603080281072a053d90c74f693212f`
- Recommended Arabic draft: يؤطر المشكلة بشكل كافٍ، ويحدد الافتراضات والقيود ذات الصلة، ويحدد أسئلة يمكن أن توجه البحث أو الاختبار.
- Arabic content hash: `05a455f0768b787d26f0496483a705701cb76795dd67197e18e41c843de71b07`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-01.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly clarifies complex ambiguity, exposes hidden assumptions, and produces strong hypotheses that improve the efficiency and relevance of downstream work.
- English source hash: `4c4acf75f729bea9013f5bba02b7ffd006a9254ba8b78d3831dc7a3f761decc4`
- Recommended Arabic draft: يوضح باستمرار الغموض المعقد، ويكشف عن الافتراضات الخفية، وينتج فرضيات قوية تحسن كفاءة وأهمية العمل اللاحق.
- Arabic content hash: `82f5fc2ee748f30c8873338b357d9c082c1f4bff5d75055273dc23b161dc69ba`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-01.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptionally clear and reusable problem-framing approaches that materially improve decisions across multiple projects or workstreams.
- English source hash: `f0eddde2eba070897ad6fa135d251f231229c1024af5eb2a3ddc9bb54b3d52c0`
- Recommended Arabic draft: يخلق مناهج صياغة مشكلة استثنائية وذات قابلية لإعادة الاستخدام تحسن بصورة جوهرية القرارات عبر مشاريع أو مسارات عمل متعددة.
- Arabic content hash: `e6512b8aaca0de3ab3900fad4ddb3f3e0219eff13a1ad007cd43b6b3f30b012d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-01.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Defines whether memory personalization should improve retrieval relevance and identifies privacy and latency as constraints.
- English source hash: `9e81a3a81d14d6b5385d9171b628ce349dc52250e22fb2cd73b1dfe2936f692d`
- Recommended Arabic draft: التقييم 3: يحدد ما إذا كان تخصيص الذاكرة يجب أن يحسن من صلة الاسترجاع ويحدد الخصوصية وزمن الوصول كقيود.
- Arabic content hash: `78a045907a87dad552589658551e5d23222a715ab0fbfd8f1f1d9a4a3820ab33`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Separates a client’s desired outcome from an assumed technical solution before selecting models.
- English source hash: `5ff34dec106cfa081c2b9b08ea9f763044d37af894b12bb6d286df50748794e2`
- Recommended Arabic draft: التقييم 3: يفصل النتيجة المرغوبة للعميل عن حل تقني مفترض قبل اختيار النماذج.
- Arabic content hash: `c934e35543f3cdd3025c3e5da868e7a3ba2d5ed8eacfc7cb749f154537c31f57`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Detects that a weak OCR result is actually caused by image quality distribution and reframes the experiment accordingly.
- English source hash: `fb2379e81f50fd8fa36feca8368fc9bdbb98cd8d53120d96b5223356aad0ec6f`
- Recommended Arabic draft: التقييم 4: يكتشف أن نتيجة OCR ضعيفة سببها في الواقع توزيع جودة الصورة ويعيد صياغة التجربة وفقاً لذلك.
- Arabic content hash: `881e0bc1e25d01b463f3d9d705d3fa07e020f8aeb678673ffe5d14a039a4f61d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Creates a reusable framing method that consistently prevents solution-first errors across the department.
- English source hash: `19269ca0eceade562fdc1e7ff1e9e03906599ed867c2c059d8b4263000c3c403`
- Recommended Arabic draft: التقييم 5: يخلق طريقة تأطير قابلة لإعادة الاستخدام تمنع باستمرار أخطاء الحل أولاً عبر القسم.
- Arabic content hash: `534eb2fb6982df1678e534ab26c1109fa588d8cbd25df596470a7b162b2a1c85`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-01.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Rewriting the project description in technical language is not sufficient if the uncertainty remains undefined.
- English source hash: `6ecc3e42a7e99628d34a77e2e75b435293992efd46234167ac27b757ee9125ec`
- Recommended Arabic draft: مثال مضاد: إعادة كتابة وصف المشروع بلغة تقنية لا يكفي إذا ظل عدم اليقين غير محدد.
- Arabic content hash: `ff62db3758b939c7e2ad95a24d56510d1e98e2c41c0613eaa341a693b1900224`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Research Quality and Technical Exploration
- English source hash: `463c61ac822b3137ef28fa9b51dafebd8a49fa67c57bc481bd47a9d7f206f07e`
- Recommended Arabic draft: جودة البحث والاستكشاف التقني
- Arabic content hash: `6792a1acb46f83aefa8eadbab5f2fb7f8c07f4a8f6320927de0ea6e88e26245c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Artifact-Based + Outcome-Based
- English source hash: `4a4d0a9e6504eede37c18dc2718cd8288d28b9731a59350ac8deb2f829d9a9d9`
- Recommended Arabic draft: مستندات + نتائج
- Arabic content hash: `22910c2c4d1a68c74046d6f1206eec8699fdc0dcae6d53702dcc9a3530bff8ef`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `ARL-02.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Selects, studies, and compares relevant sources, tools, models, and approaches with sufficient depth and focus to inform the work.
- English source hash: `e957342b2024599942e3fe802de73e5d37aae09cb4fc1af74803cda93e49ccd8`
- Recommended Arabic draft: يختار ويدرس ويقارن المصادر والأدوات والنماذج والمناهج ذات الصلة بعمق وتركيز كافيين لإثراء العمل.
- Arabic content hash: `e41334c672e4cbb3950c64fa89ae44e805f240e4e99e76e874439ce1dbf288a8`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: Rapid AI change requires continuous exploration, but value comes from relevant and critical research rather than consuming large amounts of content.
- English source hash: `79be9d4517eef58d18f5640f0f7682e0f6bd1d016aea94a6ee75c39494ead519`
- Recommended Arabic draft: يتطلب تغيير الذكاء الاصطناعي السريع استكشافاً مستمراً، ولكن القيمة تأتي من البحث الهادف والنقدي بدلاً من استهلاك كميات كبيرة من المحتوى.
- Arabic content hash: `0e31666d0c6421aecfaf22840378bd628d3513e8e2e885d81dbdc2bff6eeff42`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Source selection; relevance; breadth and depth; comparison; credibility; understanding limitations; targeted exploration.
- English source hash: `cf8f20045cc5aa85e4dacb663764d95172fa262a67baed268597125f7762cfdc`
- Recommended Arabic draft: اختيار المصادر؛ الصلة؛ الاتساع والعمق؛ المقارنة؛ المصداقية؛ فهم القيود؛ الاستكشاف المستهدف.
- Arabic content hash: `7dca3921c2c316c4615c4a6cd53266e7ed81e078d6e73c2dd43a1d119b628a2d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Number of papers, videos, repositories, or courses; experiment quality assessed under ARL-03; implementation assessed under Section 3.
- English source hash: `9ca4f84703c4af60224dcd465970a5509333e175cf839c0c63e9643982784253`
- Recommended Arabic draft: عدد الأوراق، أو مقاطع الفيديو، أو المستودعات، أو الدورات التدريبية؛ جودة التجربة المقدرة تحت ARL-03؛ التنفيذ المقدر في القسم 3.
- Arabic content hash: `a4f05b596615f798c02b8c25461958d48a400f8bab94f0793388e3ae6e19ca12`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Research notes; source lists; comparison documents; repository reviews; paper summaries; technical recommendations; applied learning records.
- English source hash: `751abdea8d032c07c3a90988a97209eb9797987fb9995a5e7b9b60722f48c69f`
- Recommended Arabic draft: ملاحظات البحث؛ قوائم المصادر؛ وثائق المقارنة؛ مراجعات المستودعات؛ ملخصات الأوراق البحثية؛ التوصيات التقنية؛ سجلات التعلم التطبيقي.
- Arabic content hash: `6dbab3ae09dc735e39bb161914848d781973070219ea4ea4cc915a189e385446`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Research is repeatedly superficial, poorly targeted, unreliable, or disconnected from the problem, leading to weak or misleading direction.
- English source hash: `4ae5acfd3af2b75ca90d38cdb4e8d7cd16b253ce0d48ffaaa18c3d4245943b28`
- Recommended Arabic draft: البحث سطحي بشكل متكرر، وغير مستهدف جيداً، أو غير موثوق به، أو منفصل عن المشكلة، مما يؤدي إلى توجيه ضعيف أو مضلل.
- Arabic content hash: `b88403ea343e8e94dc68e3582a97b1e6c99b9dac2f25ec026c2f0be00e332e8e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-02.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Finds relevant material but comparison, critical understanding, or focus is inconsistent and important alternatives or limitations are often missed.
- English source hash: `b0af11a9ab21796df25b701b2e9b0738b7a20e606224915bf57619e1858ac254`
- Recommended Arabic draft: يجد مواد ذات صلة ولكن المقارنة أو الفهم النقدي أو التركيز غير متسق وغالباً ما يتم تفويت بدائل مهمة أو قيود.
- Arabic content hash: `834cb5ed38eb9a9f38c4128cf3c74da3bff94fefe94246a583d3ec9346260fd7`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-02.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Uses appropriate and credible sources, explores relevant alternatives, and extracts information that meaningfully informs the work.
- English source hash: `5675bf94a9256eb8dca1929cb5dd993096fd73a368cf0c5e9a9d3921d30e614a`
- Recommended Arabic draft: يستخدم مصادر مناسبة وذات مصداقية، ويستكشف بدائل ذات صلة، ويستخلص معلومات تثري العمل بشكل هادف.
- Arabic content hash: `08f0cb418ec5a3a4eba88fa9592f1cb62482954b211eb58608095d3278ffe166`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-02.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Conducts focused, critical, and efficient exploration that repeatedly reveals important options, limitations, or opportunities others might miss.
- English source hash: `759c66fb46c88798b8b8dd9e72198dcdf5398f97a96e4345b6cd06e8c3d0367a`
- Recommended Arabic draft: يجري استكشافاً مركزاً ونقدياً وفعالاً يكشف باستمرار عن خيارات أو قيود أو فرص مهمة قد يغفلها الآخرون.
- Arabic content hash: `05bb403464ab849b31db4fe26b721b6d452d1e30d2b16e375b3fc39c08c0dbdf`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-02.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Produces exceptional research synthesis that materially shifts product or technical direction and becomes a durable reference for multiple projects or the team.
- English source hash: `ef5b7bc4eb96317d911e44765d8d7903c0f120c0c9dbee9c7a46ae0b171699cf`
- Recommended Arabic draft: ينتج توليف بحثي استثنائياً يحول بصورة جوهرية اتجاه المنتج أو التقنية ويصبح مرجعاً مستداماً لعدة مشاريع أو للفريق.
- Arabic content hash: `f9407011b6c5b2dbe23a4de54d359a71f75ea1bf9c5b58e621e75e99227832d9`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-02.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Compares several memory approaches using relevant project constraints and documents meaningful trade-offs.
- English source hash: `3c20dc327e1ec25df7e2f9a8d812ae21eaa580ab194c662e828ea4b078ff2041`
- Recommended Arabic draft: التقييم 3: يقارن عدة مناهج للذاكرة باستخدام قيود المشروع ذات الصلة ويوثق المفاضلات الهادفة.
- Arabic content hash: `d9c0fc06b648eb332c8e08055bf13227748ca458030d4c3b3f1fd520011be2d1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Reviews a research paper and an implementation repository, identifying where the published assumptions do not match the current data.
- English source hash: `447f9bedebdc376032e95d8371b16860d2fb5ff4e741b1e06c0f066fced28ad2`
- Recommended Arabic draft: التقييم 3: يراجع ورقة بحثية ومستودع تنفيذ، ويحدد فيه أين لا تتطابق الافتراضات المنشورة مع البيانات الحالية.
- Arabic content hash: `87cdf76e7149b8fa8f18b843c2dca6aa0441198c8f925d16aeca996d78e16c7f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Finds an alternative model or method that materially reduces cost or operational complexity after a focused comparison.
- English source hash: `161bad72a0a6e0bfbf543b4c2e7bf1f2df5b68c26c6ec2971c049edd8eb26bf5`
- Recommended Arabic draft: التقييم 4: يجد نموذجاً بديلاً أو طريقة تقلل بصورة جوهرية التكلفة أو التعقيد التشغيلي بعد مقارنة مركزة.
- Arabic content hash: `a75336a3ef28fd28b60987451a52c66687d70e8b652ee72205354711ce8586a4`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Creates a research synthesis that becomes the department’s reference and informs several product decisions.
- English source hash: `11ca41e98e1da850ca296b7579b48bc509e47a2fa0b07a8f4aede64ea0960f0d`
- Recommended Arabic draft: التقييم 5: يخلق توليف بحثي يصبح مرجع القسم ويغذي عدة قرارات منتج.
- Arabic content hash: `be76b74cdc0f61d9642ee3ae2b1c5cb1547fb553466e3b86f4a23f7dff4c08be`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-02.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Listing many links or completing a course does not demonstrate research quality without understanding and relevance.
- English source hash: `ec8f62519ce4c73a3c7b8de32e678f81e3920edc5fff140e9bab9590caed2433`
- Recommended Arabic draft: مثال مضاد: سرد العديد من الروابط أو إكمال دورة تدريبية لا يثبت جودة البحث بدون فهم وصلة.
- Arabic content hash: `c3fb8b32c34d94d9845d9287bc3d805ad19081eef48c2857b4e8c94c7fd5f957`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Experiment and Evaluation Design
- English source hash: `7b34111d4afd559455c997634590fdb43582d8470824296e92c7789a02b5122a`
- Recommended Arabic draft: تصميم التجربة والتقييم
- Arabic content hash: `a9f72c2b0fa007ccbbc62e7f188e3df959c631ae674e5955c256c4bd693f6cbb`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Artifact-Based + Outcome-Based
- English source hash: `4a4d0a9e6504eede37c18dc2718cd8288d28b9731a59350ac8deb2f829d9a9d9`
- Recommended Arabic draft: مستندات + نتائج
- Arabic content hash: `22910c2c4d1a68c74046d6f1206eec8699fdc0dcae6d53702dcc9a3530bff8ef`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `ARL-03.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Designs fair, reproducible, and decision-relevant experiments with suitable baselines, test cases, measures, controls, and documented conditions.
- English source hash: `43c81f6b5490e9bac528c4c9e053094bda1f5a1918ada18674121a32f785ddd3`
- Recommended Arabic draft: يصمم تجارب عادلة وقابلة للتكرار وذات صلة بالقرار مع خطوط أساس مناسبة، وحالات اختبار، ومقاييس، وضوابط، وظروف موثقة.
- Arabic content hash: `fd9214ca016e33e674c34a7dee75609d8aab33a01a85a672708bb9debe14c353`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: AI results are easy to overstate when comparisons are inconsistent, samples are weak, or metrics do not match the real use case.
- English source hash: `4a691c734071ca1f484ee8a89dfe3679768b78d4970ad95a2e398c14f9d941f0`
- Recommended Arabic draft: من السهل المبالغة في نتائج الذكاء الاصطناعي عندما تكون المقارنات غير متسقة، أو العينات ضعيفة، أو لا تتطابق المقاييس مع حالة الاستخدام الفعلية.
- Arabic content hash: `7a6a2a882ed230d2a97e252627d60eae2894fdfa30ab6bf2ddacad3b094a0e65`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Baseline; test set; metric choice; qualitative and quantitative evaluation; reproducibility; controls; failure cases; evaluation plan.
- English source hash: `5cd96b130b0879924569066547267dcda3d4c22caef3690e24c61e63d26cbce4`
- Recommended Arabic draft: خط الأساس؛ مجموعة الاختبار؛ اختيار المقياس؛ التقييم النوعي والكمي؛ قابلية إعادة الإنتاج؛ الضوابط؛ حالات الفشل؛ خطة التقييم.
- Arabic content hash: `b20856eef4c1c2a649142feda787d86cd876a56fa3b4e41c6e60db1ea7b0e926`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Final production reliability; implementation quality; merely running a model; client acceptance unless included in dynamic criteria.
- English source hash: `03448e3bb66cbf1b75a6c71aa6834c03e8231373aebd5107ae238f6e2ad5d6c1`
- Recommended Arabic draft: موثوقية الإنتاج النهائية؛ جودة التنفيذ؛ مجرد تشغيل نموذج؛ قبول العميل ما لم يكن مدرجاً في المعايير الديناميكية.
- Arabic content hash: `903693251104df31231da42f7a340e771eeabb4d9e6ec938ad8be42ed0a61a04`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Experiment plans; benchmarks; test datasets; baseline results; evaluation tables; failure analysis; reproducibility instructions.
- English source hash: `5ad43be6d2f1e111ab03a287ed3b01fd910c46f60177ade27b3745df2d64a0c5`
- Recommended Arabic draft: خطط التجارب؛ المعايير المرجعية؛ مجموعات بيانات الاختبار؛ نتائج خط الأساس؛ جداول التقييم؛ تحليل الفشل؛ تعليمات قابلية إعادة الإنتاج.
- Arabic content hash: `af1c2a16e4e9252e40afd1855bd59d9cf2f96b540dc809c4fc78f1160a116aa6`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Experiments repeatedly lack valid comparison, appropriate measures, or documented conditions, making results unreliable or unusable for decisions.
- English source hash: `70aeb6e3e274c255873821a140fc7f44e6a4055585473201bc43b1e3ff3c76ad`
- Recommended Arabic draft: تفتقر التجارب بشكل متكرر إلى مقارنة صالحة، أو مقاييس مناسبة، أو ظروف موثقة، مما يجعل النتائج غير موثوق بها أو غير قابلة للاستخدام للقرارات.
- Arabic content hash: `25d7e6fe7cca4fa4f6991301b22eaa183171721dcfdfd4f23a02cc4dcf49361e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-03.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Runs useful tests but design quality is inconsistent; baselines, samples, metrics, or controls are incomplete in important cases.
- English source hash: `554c349ef1536a0063233a01b82724882623801b47e688f1c3becdaddc995c68`
- Recommended Arabic draft: يجري اختبارات مفيدة ولكن جودة التصميم غير متسقة؛ خطوط الأساس، العينات، المقاييس، أو الضوابط غير مكتملة في حالات مهمة.
- Arabic content hash: `495842e2f9f0e29f6df3bbd5c4576cb6c9dee8fcd90abdc2327a7335023f3ec5`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-03.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Designs appropriate experiments with clear baselines, measures, test conditions, and enough documentation to support a practical decision.
- English source hash: `120b59d46b0857212c0fdf12c896a44cfeff0dc613c9f2787c5390cb76163cda`
- Recommended Arabic draft: يصمم تجارب مناسبة بخطوط أساس واضحة، ومقاييس، وظروف اختبار، وتوثيق كافٍ لدعم قرار عملي.
- Arabic content hash: `13560b93b8161b5350d06543ceef7b58e0a8d607cfcf2f69e90f3800ff35926f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-03.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly builds robust evaluations that expose limitations, reduce false conclusions, and improve confidence in difficult technical choices.
- English source hash: `c1f1c517faf06dd9fbf412a0e8d5e8690d15c9610ce9c1db607b87a3642055c2`
- Recommended Arabic draft: يبني بشكل متكرر تقييمات قوية تكشف عن القيود، وتقلل الاستنتاجات الخاطئة، وتحسن الثقة في الخيارات التقنية الصعبة.
- Arabic content hash: `84300e324de25b5ccd2896f0b90e3d7bcc9c3e3325a9fa45537d3f220313097d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-03.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Establishes exceptional, reusable evaluation methods that materially raise the quality and reliability of experimentation across the department.
- English source hash: `15a6ba56d1e39968b2411c1bf8b6dc65426599bf532744e406bf8d2c71f5be74`
- Recommended Arabic draft: يؤسس طرق تقييم استثنائية وقابلة لإعادة الاستخدام تحسن بصورة جوهرية جودة وموثوقية التجريب عبر القسم.
- Arabic content hash: `a0ab21a32b8fbfee8e2e8cfd65318fe12c9382c0cd5ae1ce8c76f314d629552c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-03.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Compares two OCR models on the same representative sample with speed and accuracy measures.
- English source hash: `457e9f9da3d594b5ce39ee44caee841256cb7cac7b3d62717a57dd508658a5ac`
- Recommended Arabic draft: التقييم 3: يقارن نموذجي OCR على نفس العينة التمثيلية بمقاييس السرعة والدقة.
- Arabic content hash: `f84859e6c128ca3af7c79cf06cf529e1d3997153cb64810148e1e0065183614c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Defines a baseline and test cases before evaluating an agent-memory approach.
- English source hash: `aedddf1e43f6cbd4a025fddea49d819eac459855658891d1527fe84a6209331b`
- Recommended Arabic draft: التقييم 3: يحدد خط أساس وحالات اختبار قبل تقييم منهج ذاكرة الوكيل.
- Arabic content hash: `6a8323bc46ab3a979cfb091cb3a1d3b0d7eb8e3992d78769535566d02ad48ee7`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Adds failure-case categories and confidence analysis that change the recommended solution.
- English source hash: `4481c72d8baa7a5b0985f64f6d7744d770f68235217667cbef3e6d98978f4f2b`
- Recommended Arabic draft: التقييم 4: يضيف فئات حالات الفشل وتحليل الثقة التي تغير الحل الموصى به.
- Arabic content hash: `2a8769a9f466f77f063db8452dcba721f7fd3d8d511fbeaf7a0e6704dbfca471`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Builds a reusable evaluation framework adopted across multiple AI products.
- English source hash: `6b0dfb4f8c1a6f303fdd47456fa888cfa71a6434b4c6e549dd62698a2186a887`
- Recommended Arabic draft: التقييم 5: يبني إطار عمل تقييم قابل لإعادة الاستخدام يتم تبنيه عبر عدة منتجات ذكاء اصطناعي.
- Arabic content hash: `367bb4e60f5bac0905e885b02438b96665f6956a4663ba48d87d3e3f8cf0894c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-03.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Showing one successful demo or cherry-picked output is not a sound experiment.
- English source hash: `cd1a334739a4351c516c008d4dc410aabe43649788d4ca708754caed12f815ec`
- Recommended Arabic draft: مثال مضاد: عرض نموذج ناجح مرة واحدة في بيئة خاضعة للرقابة ليس دليلاً كافياً على الموثوقية.
- Arabic content hash: `5bad960bcb6d808c7d3705fa42cd20afaddbffc411565b50827a266cf86d9eb2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Insight, Decision-Making, and Applied Learning
- English source hash: `e981aab1b89d5b9f30041117cd58afb6e54f24f561e2adced9b31510d1fbb775`
- Recommended Arabic draft: الرؤى واتخاذ القرار والتعلم التطبيقي
- Arabic content hash: `b72cd03eef7e8b3ad3038a952adf145c7dcfb1a6373733a5a156fac60a1dc823`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Outcome-Based + Mixed
- English source hash: `b73c35a7e9d5055e631d498a315be41ac2739d59bb5a276d207e92f4e995bf9b`
- Recommended Arabic draft: نتائج + مختلط
- Arabic content hash: `494d8dfa7dd8407dde647972222dc520da72b5ef510c372418b06bc12c5a65e2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `ARL-04.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Interprets research and experimental results accurately, converts them into justified decisions or practical improvements, and transfers useful learning when appropriate.
- English source hash: `b30610cc49d758dce2713be19f524116aa49f1b361b0d2b43034de79ed5bfcb3`
- Recommended Arabic draft: يفسر نتائج البحث والتجارب بدقة، ويحولها إلى قرارات مبررة أو تحسينات عملية، وينقل التعلم المفيد عند الاقتضاء.
- Arabic content hash: `87d457f93cc3655588646b9986906ca9104664eaeca2911aee592c4bde6e609b`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: Research and learning create value only when they improve understanding, choices, work methods, products, or team capability.
- English source hash: `f96dd0f0f0ca111f0999273f81713a53f45b151c1cd3768b1c55ea78e987615b`
- Recommended Arabic draft: لا تخلق الأبحاث والتعلم قيمة إلا عندما تحسن الفهم، أو الخيارات، أو طرق العمل، أو المنتجات، أو قدرة الفريق.
- Arabic content hash: `6714e87f34e0ecea463c89a9d39274d85ec6296b434585456f3d30cb2cb9febb`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Interpretation; conclusion; decision rationale; learning application; rejected-path value; knowledge transfer; uncertainty communication.
- English source hash: `e3f0baab2efb3682d388e03389d8d1c2a3981c3dcdac9e72cd0cdab05b53056f`
- Recommended Arabic draft: التفسير؛ الاستنتاج؛ الأساس المنطقي للقرار؛ تطبيق التعلم؛ قيمة المسار المرفوض؛ نقل المعرفة؛ التواصل بشأن عدم اليقين.
- Arabic content hash: `ac8edb3bc7960d397272eb064db6add20b2565458c453841e812163161d95dbf`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Raw research volume; architecture execution; project outcome itself; confident claims unsupported by results.
- English source hash: `67ffe613e52c56ed6187cefd41bfd1975ebabd3ad4414cdd508b43698f4c492b`
- Recommended Arabic draft: حجم البحث الخام؛ تنفيذ البنية؛ نتيجة المشروع نفسها؛ الادعاءات الواثقة غير المدعومة بالنتائج.
- Arabic content hash: `f618037a0fbba6db32eefb5e4f9e7d2fda1360dc32ac90e6df41fdd3eab3c893`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Decision records; recommendations; applied changes; lessons learned; rejected-option rationale; knowledge sessions; coaching insights.
- English source hash: `7a01bfe77119ba3fe05ca5fa34013fd8f046a81ad80c73075b22cf6130897bf5`
- Recommended Arabic draft: سجلات القرار؛ التوصيات؛ التغييرات المطبقة؛ الدروس المستفادة؛ الأساس المنطقي للخيارات المرفوضة؛ جلسات المعرفة؛ رؤى التدريب.
- Arabic content hash: `3ed5b9ccdebca9904bffbf7b01bf450246636a560017ac650bd3c1d3a29d4c31`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Frequently draws unsupported conclusions, fails to extract usable learning, or repeats unproductive paths without adapting decisions.
- English source hash: `f506b8fa3328331fdbc56b3c3f831277a5b757bf14f47ca89c4c2d6de1ce31fc`
- Recommended Arabic draft: يستخلص بشكل متكرر استنتاجات غير مدعومة، ويفشل في استخراج تعلم قابل للاستخدام، أو يكرر مسارات غير منتجة دون تكييف القرارات.
- Arabic content hash: `b02ad257b81e41d3af5c8a6fb767528c3ad164da0d87530b0f81af6e00100c7e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-04.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Identifies basic lessons but conclusions, application, or decision rationale is inconsistent and often needs significant guidance.
- English source hash: `f3805b57dff1860f9b1ec2281954b7ff635e66af8f2b4545ef99a0880754fdfa`
- Recommended Arabic draft: يحدد الدروس الأساسية ولكن الاستنتاج أو التطبيق أو الأساس المنطقي للقرار غير متسق وغالباً ما يحتاج إلى توجيه كبير.
- Arabic content hash: `526175a78fea80de71ee3380c5f6cae964486a81092cf94e52976eb55889ebe4`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-04.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Interprets results appropriately, records practical conclusions, applies learning to decisions or work, and shares relevant knowledge.
- English source hash: `e741079d2a5dafe5712381de917325f260cc378fcb20017aae0a605db48250e8`
- Recommended Arabic draft: يفسر النتائج بشكل مناسب، ويسجل استنتاجات عملية، ويطبق التعلم على القرارات أو العمل، ويشارك المعرفة ذات الصلة.
- Arabic content hash: `93a2f9a64979e07a6602ba70a5ca04dbc585ee1f15f11f463ff395460876be10`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-04.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly converts ambiguous or failed results into high-value decisions, improvements, and transferable learning beyond the immediate task.
- English source hash: `47641370d23e9bbaac202b5490cc2701d765426057691bb8bceeecd905ebdf93`
- Recommended Arabic draft: يحول بشكل متكرر النتائج الغامضة أو الفاشلة إلى قرارات عالية القيمة، وتحسينات، وتعلم قابل للنقل يتجاوز المهمة المباشرة.
- Arabic content hash: `df2af1a8f96d7dc8ab55e15d74db5787c24aeaf9090438e6e920c973ca454b23`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-04.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional, sustained decision quality and reusable insight that materially changes products, methods, or team capability across multiple contexts.
- English source hash: `ec7246a805d654ec39e89652304c41465f2971712f35bba2bae55d456bd7901a`
- Recommended Arabic draft: يخلق جودة قرار واستنتاج استثنائية ومستدامة تحسن بصورة جوهرية المنتجات، أو الطرق، أو قدرة الفريق عبر سياقات متعددة.
- Arabic content hash: `65c15bb781a87e73b10348f4f23e488517ccec4c3e6fcb6765b8a467d3c31ebd`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `ARL-04.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Concludes that a model is unsuitable for weak images, records why, and chooses a better next experiment.
- English source hash: `0a7fe86e4e5c4349dbe8100bf7e6b8b9942c3c9f0d5e8f4facc7dd00ecaec32c`
- Recommended Arabic draft: التقييم 3: يستنتج أن النموذج غير مناسب للصور الضعيفة، ويسجل السبب، ويختار تجربة تالية أفضل.
- Arabic content hash: `8e7146debcaf74374b13e4aca51edee7c86d1f54a6cb46fe201e4e59973a1ba9`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Applies learning from a course to improve an actual workflow and documents the effect.
- English source hash: `cead48e6552c8c6105a9aa49d4f91bca7136b8b6845defc863aba4d57efb1d54`
- Recommended Arabic draft: التقييم 3: يطبق التعلم من دورة تدريبية لتحسين سير عمل فعلي ويوثق التأثير.
- Arabic content hash: `33a05b9ee2e80f9ff47ae7addc9a95731e4a582fc782dc567614a1c45736d3f8`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Uses a failed POC to identify a reusable constraint that prevents repeated waste in later projects.
- English source hash: `f7ede263e9c96f30bc176e7463f9431a620927c9b3f4a8a194fe00917d03bf04`
- Recommended Arabic draft: التقييم 4: يستخدم POC فاشلاً لتحديد قيد قابل لإعادة الاستخدام يمنع الهدر المتكرر في المشاريع اللاحقة.
- Arabic content hash: `81e59f58f3553334714608ec8df899ce27a06cd7690b272ecfb0a2abb58ae408`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Produces insight that changes the department’s product strategy or operating method across several projects.
- English source hash: `7cfda9cd170f88c44f659eb39e1a72d4a79534b32c94550f88b00e9b8b5c8030`
- Recommended Arabic draft: التقييم 5: ينتج رؤى تغير استراتيجية المنتج أو طريقة تشغيل القسم عبر عدة مشاريع.
- Arabic content hash: `1f1bc8299d77b495ae6064f72d3dcaa657b202265b8e25f200c91943264a5536`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `ARL-04.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Stating that something 'worked' or 'did not work' without interpreting why is not applied learning.
- English source hash: `5b1cd50cef85d24644a939bf60fc57297564956acefe86907ed5f01eab3bf844`
- Recommended Arabic draft: مثال مضاد: القول بأن شيئاً ما 'نجح' أو 'لم ينجح' دون تفسير السبب ليس تعلمًا مطبقاً.
- Arabic content hash: `9c4cf124987cd67da8223f4a28949042c50bc08e3cac1bb04e68e11951d66472`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Solution Design and Technical Judgment
- English source hash: `cb5a3ce2ef17eeb806c3e2ee93de10583343efca73354033535bd03dfa37b9be`
- Recommended Arabic draft: تصميم الحل والحكم التقني
- Arabic content hash: `bc458a73a813180ac2876261554cccfe7a074adc89b35b7bf5d2b04073810693`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Artifact-Based + Outcome-Based + Mixed
- English source hash: `bbc373302986317c226e0f7b235dbd865717cfd55292adefc430d5a1630adeb1`
- Recommended Arabic draft: مستندات + نتائج + مختلط
- Arabic content hash: `a8985c8be91203e306737e01d2b751d20a6a7c6edae8084a13b498714f64bcee`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `EED-01.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Selects and structures a solution appropriate to the problem, constraints, risk, and expected future use, with clear boundaries, dependencies, and justified trade-offs.
- English source hash: `480bf0074b4a59a8a49945fa6eb6c06f02df71fef920204500bdb02d7930e1d3`
- Recommended Arabic draft: يختار ويُنظم حلاً مناسباً للمشكلة والقيود والمخاطر والاستخدام المستقبلي المتوقع، مع حدود واضحة، وتبعيات، ومفاضلات مبررة.
- Arabic content hash: `ffdef562e06f7a16f76a01a0f3cf668e3bc958d65af16aeb0b68272f52851a07`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: AI-assisted development makes code generation easier, but sound architecture and technical judgment remain essential.
- English source hash: `401546641cab734cb52767e6c0cd4de19e6653eafc839844f1c5304a46a5d5f9`
- Recommended Arabic draft: يجعل تطوير المساعدة بالذكاء الاصطناعي توليد الكود أسهل، لكن البنية السليمة والحكم التقني يظلان ضروريين.
- Arabic content hash: `ace047f1dd697885546dce6c53ada6e90aa055dc4d39018c74c5dcd1a1e1598a`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Architecture; component boundaries; technology selection; simplicity; modularity; risk trade-offs; dependency design; technical decision rationale.
- English source hash: `e0f275325d3d0b3c42b94d9903e37bf43cbfb5601c46b202357d8fb09aa975d2`
- Recommended Arabic draft: البنية؛ حدود المكونات؛ اختيار التكنولوجيا؛ البساطة؛ النمطية (Modularity)؛ مفاضلات المخاطر؛ تصميم التبعيات؛ الأساس المنطقي للقرار التقني.
- Arabic content hash: `5125782036f9255fa11f540a176575a8984d1c1f67051dceabbebd29e51ac928`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Research depth; experiment method; code volume; final project success; theoretical complexity not required by the use case.
- English source hash: `c25c0cb7cec6cd4cf1cbcd3b83fb08d3f41bdc1a3720b038e30c7fd8bbf71d7d`
- Recommended Arabic draft: عمق البحث؛ منهج التجربة؛ حجم الكود؛ نجاح المشروع النهائي؛ التعقيد النظري غير المطلوب من قبل حالة الاستخدام.
- Arabic content hash: `b51880fa4ec0baadddcdeb4c18262003ed7818a1851435de0decc5d53cfbb8bc`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Architecture diagrams; technical decision records; project/workstream documents; design reviews; dependency maps; implementation outcomes.
- English source hash: `4f25d31484242a9952add5f9af288ca9ff6a3c8d2468a57eec81efd178583a4b`
- Recommended Arabic draft: مخططات البنية؛ سجلات القرار التقني؛ مستندات المشروع/مسار العمل؛ مراجعات التصميم؛ خرائط التبعيات؛ نتائج التنفيذ.
- Arabic content hash: `fa738152bc4843751f99ef8ffdce65f5db07587e342f3cf5ab97f1f85a17f0d4`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Frequently selects unsuitable or unnecessarily complex designs, overlooks major dependencies or constraints, and requires substantial redesign.
- English source hash: `719190e6be2bf11bf9be0fe9909a59eca175043f4b4993d35ca845930d28f0cf`
- Recommended Arabic draft: يختار بشكل متكرر تصاميم غير مناسبة أو معقدة بشكل مفرط، ويتغاضى عن تبعيات أو قيود رئيسية، ويتطلب إعادة تصميم كبيرة.
- Arabic content hash: `528960ff0be97f73ea5358033e8bd89646acd2ae0c4611d86708d6f494bde97b`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-01.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Produces workable designs in simple cases but important trade-offs, boundaries, or future implications are inconsistently handled.
- English source hash: `6e432cbaacd6d9c00fcbf8c210791a52e98e3366b64d83058faa540504a3f22f`
- Recommended Arabic draft: ينتج تصاميم قابلة للعمل في الحالات البسيطة ولكن يتم التعامل مع المفاضلات أو الحدود أو التداعيات المستقبلية المهمة بشكل غير متسق.
- Arabic content hash: `e1f4e77c2b500e68b47c6d7ead67f7e1780fc2307763aa5825148bff6311d872`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-01.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Designs solutions appropriate to the problem, explains key choices, manages dependencies, and balances simplicity with maintainability.
- English source hash: `1a9e6e1cbba49a9c1553369ce26a928f695731fd1d75982a2e179785aaa73371`
- Recommended Arabic draft: يصمم حلولاً مناسبة للمشكلة، ويشرح الخيارات الرئيسية، ويدير التبعيات، ويوازن بين البساطة وقابلية الصيانة.
- Arabic content hash: `9c11879852422258ad4a71283bc6fe7119e2085f1439360f8c8d2affa1d440ed`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-01.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly makes strong technical judgments in complex contexts, avoids unnecessary complexity, and improves architecture beyond immediate requirements.
- English source hash: `e24514c6a09c6e27d3d97ad70ee5b3c0207826b0becbd19d170ce5f730ac5230`
- Recommended Arabic draft: يتخذ بشكل متكرر أحكاماً تقنية قوية في سياقات معقدة، ويتجنب التعقيد غير الضروري، ويحسن البنية بما يتجاوز المتطلبات الفورية.
- Arabic content hash: `97159042758e268f014a0176492fdc5fd49e8645828c15a8b462931d65eedf6b`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-01.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional design direction or reusable architecture that materially improves multiple products, reliability, or future development capability.
- English source hash: `860ee5a41a1fcba0cd34ac0dcc6cb3921c00f2c908bb61cf11dfb45eaf906016`
- Recommended Arabic draft: يخلق اتجاه تصميم استثنائي أو بنية قابلة لإعادة الاستخدام تحسن بصورة جوهرية عدة منتجات، أو الموثوقية، أو قدرة التطوير المستقبلية.
- Arabic content hash: `b025b884c60f2d9438121c711dcc5da0b93dd707ace95f3794b4e1118f7c4616`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-01.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Chooses a simple modular workflow that fits the POC while leaving clear extension points.
- English source hash: `da38a4dce6c6eee987e73221f91ff10b4d2f3e43068ac5ea87850bf0122c0cd5`
- Recommended Arabic draft: التقييم 3: يختار سير عمل نمطي بسيط يتناسب مع POC مع ترك نقاط تمديد واضحة.
- Arabic content hash: `caa0b27ef10beb644e2d641f591bea4e2f075b61892fa291e2f5835fbc4a21e0`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Documents why a local or external model is suitable for the project’s constraints.
- English source hash: `8ca7a09a5644a6cc8592d27aa2f54ebe2bec52a88e1ac837f2e824affb8a7cd6`
- Recommended Arabic draft: التقييم 3: يوثق سبب ملاءمة نموذج محلي أو خارجي لقيود المشروع.
- Arabic content hash: `15419b23f8559249b25ad2677dbc0f452dc39324ec7d485e55605dc70996d20c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Simplifies an overengineered design while preserving future maintainability and reducing operational risk.
- English source hash: `71cb7c299c454cda050e465404e06713cfef7ca3f1949cf41472aea704a2702e`
- Recommended Arabic draft: التقييم 4: يبسط تصميماً مفرط الهندسة بينما يحافظ على قابلية الصيانة المستقبلية ويقلل المخاطر التشغيلية.
- Arabic content hash: `3544123080d9cc36bdb3b7d3a9b0f6f8707647bceb0f9f387ee9392d728e30a3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Creates a reusable architecture pattern adopted across multiple products.
- English source hash: `3f573d8cdf99a10e64c8176969c34d3a84f919b124288f73ef278092551b762f`
- Recommended Arabic draft: التقييم 5: يخلق نمط بنية قابلة لإعادة الاستخدام يتم تبنيه عبر عدة منتجات.
- Arabic content hash: `67331466638c02b0ba4e08d752d862945c5ef99dfb6cd437e126ca05f60899e3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-01.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Using more services, frameworks, or agents does not automatically demonstrate better design.
- English source hash: `421b4c9bb3f94c9a2c6a0b42e165dd098fe566675c2faf6322f0d16f641542ff`
- Recommended Arabic draft: مثال مضاد: استخدام المزيد من الخدمات أو الأطر أو الوكلاء لا يثبت تلقائياً تصميم أفضل.
- Arabic content hash: `f741a05594eef0e20895d5d1a84a4fce40c6a179e212039dbd85208bb4a9ffc2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Execution Quality and Oversight of Agent Outputs
- English source hash: `4bec10c945315e748ef95abfd9dbf29f4bde193dad5f0af10434dae799edceef`
- Recommended Arabic draft: جودة التنفيذ والإشراف على مخرجات الوكيل
- Arabic content hash: `8dfcbad6800ffae1b43585c1d4de3657b0381cc75372f1ae4e00529becb740a2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Artifact-Based + Outcome-Based
- English source hash: `4a4d0a9e6504eede37c18dc2718cd8288d28b9731a59350ac8deb2f829d9a9d9`
- Recommended Arabic draft: مستندات + نتائج
- Arabic content hash: `22910c2c4d1a68c74046d6f1206eec8699fdc0dcae6d53702dcc9a3530bff8ef`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `EED-02.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Turns approved direction into correct, maintainable work and actively reviews, tests, and improves outputs produced manually or by AI coding agents.
- English source hash: `4f34a159677cf1b53b7b7bcc7e859fd6043d06952729b9f67594e2c31f6d337a`
- Recommended Arabic draft: يحول التوجيه المعتمد إلى عمل صحيح وقابل للصيانة، ويراجع ويختبر ويحسن بنشاط المخرجات المنتجة يدوياً أو بواسطة وكلاء الترميز بالذكاء الاصطناعي.
- Arabic content hash: `070fed7e609a77ff64c75d71681c04a54c00fe3767cea57184456c7cbe596f47`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: The team relies heavily on coding agents. Professional quality depends on direction, review, correction, and ownership—not on who typed the code.
- English source hash: `9966f9c8cf002f8a21a4e965515be3f5dd4254e564058c2e9c802732ea59c5f1`
- Recommended Arabic draft: يعتمد الفريق بشكل كبير على وكلاء الترميز. تعتمد الجودة المهنية على التوجيه والمراجعة والتصحيح والملكية - وليس على من كتب الكود.
- Arabic content hash: `9ab225d5a51eef00a2c4c939eee4e73b5f00621f1660277f5dc3e1933a9a54a4`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Implementation correctness; maintainability; code and configuration organization; agent prompting and control; review; error detection; iterative correction; responsibility for output.
- English source hash: `c0dee60385d1878ad1b6aa663f533a04e86a77de8c0a459a9782dc1054428639`
- Recommended Arabic draft: صحة التنفيذ؛ قابلية الصيانة؛ تنظيم الكود والإعدادات؛ توجيه الوكيل ومراقبته؛ المراجعة؛ اكتشاف الأخطاء؛ التصحيح التكراري؛ مسؤولية المخرجات.
- Arabic content hash: `0b1a4ed118eb4cf627645d84756be3383d949c58bda11c517a6efadda1d27dfb`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Commit count; manual coding speed; tool preference; experimentation quality; final integration reliability assessed under EED-03.
- English source hash: `ef3af8b994aa6c4713efa01e592cbdbdab18ae75eddb30d9cd1ef2aaf119e054`
- Recommended Arabic draft: عدد الالتزامات (Commits)؛ سرعة الترميز اليدوي؛ تفضيل الأدوات؛ جودة التجربة؛ موثوقية التكامل النهائي المقدرة تحت EED-03.
- Arabic content hash: `501733114585e30b485327d525b216b847cca187b00b1ce19e1c71e2b1c2c076`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Code and configuration; PRs; reviews; defect history; agent-generated changes with correction records; implementation demos; maintainability outcomes.
- English source hash: `63d6ddf9490b25cb9198008abf533f0133506cdf3af2e6a435bdeeaef8016b5f`
- Recommended Arabic draft: الكود والإعدادات؛ طلبات السحب (PRs)؛ المراجعات؛ تاريخ العيوب؛ التغييرات التي أنشأها الوكيل مع سجلات التصحيح؛ عروض التنفيذ؛ نتائج قابلية الصيانة.
- Arabic content hash: `94dc04fb67f8be9ed9e20921793febf11982b9edbea84c6b98717fa753af5004`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Frequently accepts incorrect or unsuitable outputs, produces fragile work, or cannot explain and take responsibility for what was implemented.
- English source hash: `5076968a335674e08a5ed24262b968c335deedf18a79e2d7c6fa8a53710fd98d`
- Recommended Arabic draft: يقبل بشكل متكرر المخرجات غير الصحيحة أو غير المناسبة، وينتج عملاً هشاً، أو لا يستطيع شرح وتحمل مسؤولية ما تم تنفيذه.
- Arabic content hash: `aa592388c611f00eb27038002d6621d3a53fba70740fd035fc1e5433f8b22ab3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-02.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Produces usable work but review, correction, maintainability, or agent oversight is inconsistent and recurring defects require substantial support.
- English source hash: `5931f7bad64b76aea75a3e7f46d30e77c6ff1e730cefe465516d421663e67c9d`
- Recommended Arabic draft: ينتج عملاً قابلاً للاستخدام ولكن المراجعة أو التصحيح أو قابلية الصيانة أو الإشراف على الوكيل غير متسق، وتتطلب العيوب المتكررة دعماً كبيراً.
- Arabic content hash: `af767947da9ad5394087e518662440e02377e48c082f1b0a96ea4e2a13082951`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-02.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Implements correctly, reviews agent outputs, understands the solution, corrects issues, and leaves work maintainable for its intended context.
- English source hash: `43e874239532687a8b6859ceee9d77ff257467d7c2465565b902441762c15aed`
- Recommended Arabic draft: ينفذ بشكل صحيح، ويراجع مخرجات الوكيل، ويفهم الحل، ويصحح المشكلات، ويترك العمل قابلاً للصيانة لسياقه المقصود.
- Arabic content hash: `264e0be70e2fc500f73b5dc834027a08eee4b2cadfb690fb51e6fd947facaeef`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-02.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly delivers high-quality execution, catches subtle agent or implementation errors, and improves methods that increase speed without sacrificing control.
- English source hash: `c7388b3983bae10341f092a508374f4f413373c3c7fa538594c297ae1226e2b0`
- Recommended Arabic draft: يقدم باستمرار تنفيذاً عالي الجودة، ويلتقط أخطاء دقيقة للوكيل أو التنفيذ، ويحسن الأساليب التي تزيد السرعة دون التضحية بالسيطرة.
- Arabic content hash: `bac38e34b3d02c9e666db5114c1cc402ae3a39d5ee283436aa2312978003fdb0`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-02.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional execution practices or reusable agent-assisted methods that materially improve quality and delivery capability across the team.
- English source hash: `12edada1806ae45e656567798633bb28b99e15888e97d29d2ca06894436dc4d3`
- Recommended Arabic draft: يخلق ممارسات تنفيذ استثنائية أو طرقاً قابلة لإعادة الاستخدام بمساعدة الوكيل تحسن بصورة جوهرية الجودة وقدرة التسليم عبر الفريق.
- Arabic content hash: `c97f838dc0afcecc8cc2bc2198e64ede0fec8f2171267288a6e673cc816f2edf`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-02.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Uses Codex to build a feature, reviews the code, corrects unsafe assumptions, tests it, and can explain the implementation.
- English source hash: `43e2aa7c4002397c4a2e7819a99ce10cf5ba1f5bd684f1e18560a9c40e5a5f2c`
- Recommended Arabic draft: التقييم 3: يستخدم Codex لبناء ميزة، ويراجع الكود، ويصحح الافتراضات غير الآمنة، ويختبره، ويمكنه شرح التنفيذ.
- Arabic content hash: `f197d05b598492158bcfa3263a0dc8fa8cff231f8de6386e6dd8f05accab75cc`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Refactors an agent-generated component to match project architecture and maintainability needs.
- English source hash: `7b7de083d143946fa1a9a6c4be9177b257a8fb0ba2338f538633acd388e128e9`
- Recommended Arabic draft: التقييم 3: يعيد هيكلة مكون أنشأه الوكيل لمطابقة بنية المشروع واحتياجات قابلية الصيانة.
- Arabic content hash: `05f2fe4261d74529df7f9329005796fd395872da0edeb2ec562233c558253de2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Detects a subtle data or security issue in generated output and improves the review method for future work.
- English source hash: `e4d3ec6c990db074bd3e04156e7237a2e15d0d98f1b2cf77254f61f17df78dae`
- Recommended Arabic draft: التقييم 4: يكتشف مشكلة بيانات أو أمن دقيقة في المخرج المُنشأ ويحسن طريقة المراجعة للعمل المستقبلي.
- Arabic content hash: `54cdaecb2da2e99c43a7e9029b82ccf025797d9f5fe750af601b6687cb3f70db`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Develops a reusable agent-assisted engineering workflow that materially improves quality across the department.
- English source hash: `dabbf5242b8b8574d67d6c1f2f9d01a69bfbe875f7659fa0921ba658323eb66d`
- Recommended Arabic draft: التقييم 5: يطور سير عمل هندسي قابلاً لإعادة الاستخدام بمساعدة الوكيل يحسن بصورة جوهرية الجودة عبر القسم.
- Arabic content hash: `d4ec7e83464602dfeccd041feea6e5595678b396338b429d402f32d6b18483ab`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-02.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Generating a large amount of code quickly is not strong execution if the employee cannot validate or maintain it.
- English source hash: `c3e1544c20f645bf1485c47758093105935061c09e400fdbc0b579bd21549e41`
- Recommended Arabic draft: مثال مضاد: توليد كمية كبيرة من الكود بسرعة لا يمثل تنفيذاً قوياً إذا لم يتمكن الموظف من التحقق منه أو صيانته.
- Arabic content hash: `1fb0930ce509a0e3332298694014d87ba9f110d92e8102f5644afe4f5cccd759`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Testing, Reliability, and Integration
- English source hash: `6511f3b6d346bac3f07aa57a3bd441ae6a1af596e81aced431c3be8b4183078e`
- Recommended Arabic draft: الاختبار والموثوقية والتكامل
- Arabic content hash: `c506fdb409ef9a7186eeebeed11e12325b21a73530cc79b7cf0defb3145d07f7`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Artifact-Based + Outcome-Based
- English source hash: `4a4d0a9e6504eede37c18dc2718cd8288d28b9731a59350ac8deb2f829d9a9d9`
- Recommended Arabic draft: مستندات + نتائج
- Arabic content hash: `22910c2c4d1a68c74046d6f1206eec8699fdc0dcae6d53702dcc9a3530bff8ef`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `EED-03.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Verifies that components work as intended, handles relevant failure conditions, and integrates them reliably with the surrounding system or delivery environment.
- English source hash: `962100ed2baa4972562c1650a77b67e157af2996f35c1202ee23bc769202a747`
- Recommended Arabic draft: يتحقق من أن المكونات تعمل كما هو مقصود، ويتعامل مع حالات الفشل ذات الصلة، ويدمجها بشكل موثوق مع النظام المحيط أو بيئة التسليم.
- Arabic content hash: `c03b68828713e29a1360f73a9aae50996738f8062a09984ad2bb9187bbcfbb75`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: A successful isolated demo is not sufficient for a dependable POC, client solution, or product.
- English source hash: `8894dfe2dd7dbdae289c7d2df71ab940844c6259da5ff3a704c29dcb2f0d9ddb`
- Recommended Arabic draft: العرض التوضيحي المعزول الناجح لا يكفي لـ POC موثوق به، أو حل عميل، أو منتج.
- Arabic content hash: `f5f44318006568270fdb212124f7d85df30c1725256ca758e0493efa0442e268`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Functional tests; integration tests; failure cases; observability; error handling; environment readiness; reproducible operation; integration validation.
- English source hash: `bbf1be7380a1746813e795de4071b4eb46dd5226ea9a7b333ac12681273a239a`
- Recommended Arabic draft: الاختبارات الوظيفية؛ اختبارات التكامل؛ حالات الفشل؛ قابلية الملاحظة (Observability)؛ معالجة الأخطاء؛ جاهزية البيئة؛ التشغيل القابل لإعادة الإنتاج؛ التحقق من التكامل.
- Arabic content hash: `66f25151293778afd5658a871e541bbf9c2192ba9dcbaee3c34a8c9e0155383c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: Research experiment methodology; general code quality; client acceptance criteria unless dynamically assigned; perfection or zero-defect expectation.
- English source hash: `7a2a11d0b93974e58845b556ed2a86e1e0ffd9e7c1ac9c262dea29484e5c1b18`
- Recommended Arabic draft: منهجية تجربة البحث؛ جودة الكود العامة؛ معايير قبول العميل ما لم يتم تعيينها ديناميكياً؛ توقع الكمال أو خلو العيوب.
- Arabic content hash: `d67dc8bbae45d58b4031a9ca882944345a3aa7e62b5fb653bbd28087592ed654`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Test results; CI logs; integration demos; error-handling records; deployment checks; bug and resolution history; monitoring outputs.
- English source hash: `dc4b9665a79f982d0261cb9063a1aad3c9610433206f34dd468828bb4034c1c0`
- Recommended Arabic draft: نتائج الاختبار؛ سجلات CI؛ عروض التكامل التوضيحية؛ سجلات معالجة الأخطاء؛ فحوصات النشر؛ تاريخ العيوب وحلها؛ مخرجات المراقبة.
- Arabic content hash: `cc0f1ea30732c13ad9374247bb676a6341488faa1350d223413913945e2217db`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Frequently delivers unverified or poorly integrated work, overlooks basic failure conditions, and causes repeated instability or unusable results.
- English source hash: `e119f6e6be759d1abd0e20f03cafa2e6007776efa22a55bafd3f0caa3d14d00e`
- Recommended Arabic draft: يسلم بشكل متكرر عملاً غير متحقق منه أو مندمج بشكل سيئ، ويتغاضى عن حالات الفشل الأساسية، ويسبب عدم استقرار متكرراً أو نتائج غير قابلة للاستخدام.
- Arabic content hash: `2882d59b57071719e6ec48267b251f68a3d7dc2ff7ad32eeb66a0a03fc50f2f4`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-03.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Performs basic testing but coverage of important integration, reliability, or failure scenarios is inconsistent and issues are often discovered late.
- English source hash: `723535e4a18c36365ad64230fb2726421098bdbc306dbcd0df5f48ada38f2ee3`
- Recommended Arabic draft: يجري اختبارات أساسية ولكن تغطية التكامل أو الموثوقية أو سيناريوهات الفشل المهمة غير متسقة وغالباً ما يتم اكتشاف المشكلات في وقت متأخر.
- Arabic content hash: `aaa52962e80a3727a8bce45ad0831a27b16e2d3de3af7e3267fdda12603f1695`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-03.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Tests relevant behavior, verifies integration, handles expected failure conditions, and delivers a suitably reliable result for the project stage.
- English source hash: `e2a5e3f66d04af146481d8e2fc509cd02121a21819eddcd4fd72dc34e6e67d09`
- Recommended Arabic draft: يختبر السلوك ذي الصلة، ويتحقق من التكامل، ويتعامل مع حالات الفشل المتوقعة، ويسلم نتيجة موثوق بها ومناسبة لمرحلة المشروع.
- Arabic content hash: `bda2292827868275431b6b11211104b1d33094d8138fc1a26f8e50a9a682f8b0`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-03.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly anticipates difficult integration and reliability risks, improves validation depth, and prevents issues that would materially affect use or delivery.
- English source hash: `2843c04d716dce1f86de346626905b47984f525a4803c048462b1d5e2f616133`
- Recommended Arabic draft: يتوقع بشكل متكرر مخاطر تكامل وموثوقية صعبة، ويحسن عمق التحقق، ويمنع المشكلات التي من شأنها أن تؤثر بصورة جوهرية على الاستخدام أو التسليم.
- Arabic content hash: `72cf9597105a63da900dc9f8cfc823e92c54c8d5766a706efbb646e05a88f070`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-03.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional, reusable reliability or integration practices that materially improve several products or the department’s delivery confidence.
- English source hash: `82773865b7c6763a15a3d224251531f8e3c46af0027aa00bb9a81e742cf10e4e`
- Recommended Arabic draft: يخلق ممارسات موثوقية أو تكامل استثنائية وقابلة لإعادة الاستخدام تحسن بصورة جوهرية عدة منتجات أو ثقة القسم في التسليم.
- Arabic content hash: `2e811481cc62831c1b28de8c092dc1bd83cc9e2a7d236ac914ec9cc170276e5b`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-03.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Tests normal and expected failure paths and validates the component against the actual integration interface.
- English source hash: `3245f73ee8005ebbc3d4484ca53f55b51bab352a1fae149152631d049efab557`
- Recommended Arabic draft: التقييم 3: يختبر مسارات الفشل الطبيعية والمتوقعة ويتحقق من المكون مقابل واجهة التكامل الفعلية.
- Arabic content hash: `c65d3e6ccfacc416caac9ccd2a96e8be937fd47e53e4a54e5163ea18f4595d23`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Documents and verifies environment requirements so another employee can reproduce the result.
- English source hash: `ed374b1840ffbf33e63a150714783f47fda454ae9e42d5aaa1a6926612bcf078`
- Recommended Arabic draft: التقييم 3: يوثق ويتحقق من متطلبات البيئة حتى يتمكن موظف آخر من إعادة إنتاج النتيجة.
- Arabic content hash: `007074590585c3b3cd54a85d277007800fa93fb13e3c329ee36c857def0944c3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Builds automated integration checks that prevent repeated regressions across workstreams.
- English source hash: `a05bc17d709d846abca67591e91ce9eaa3a588b41c0a3d1e49e144022f094626`
- Recommended Arabic draft: التقييم 4: يبني فحوصات تكامل آلية تمنع التراجعات المتكررة عبر مسارات العمل.
- Arabic content hash: `a2df0dfb4a1d4e5bb20bb6f2ff740c812229fa45d110b56e10d9acb15b8448c8`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Establishes a reusable testing or reliability framework adopted across multiple products.
- English source hash: `d2a6c0f342e91178850bad9ac49c75cc9418329b0a0866d5e374d893ee8eed57`
- Recommended Arabic draft: التقييم 5: يؤسس إطار عمل اختبار أو موثوقية قابل لإعادة الاستخدام يتم تبنيه عبر عدة منتجات.
- Arabic content hash: `167a42cc376715fa1b3e6658e143a7e519cd2d90f40e3f8f50b6c2116c7a168f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-03.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: A demo that succeeds once in a controlled environment is not sufficient evidence of reliability.
- English source hash: `1a4bf9a000d271b49836aa7619fd57c5646172b265f69a6d4acc401c42b16075`
- Recommended Arabic draft: مثال مضاد: العرض الذي ينجح مرة واحدة في بيئة خاضعة للرقابة ليس دليلاً كافياً على الموثوقية.
- Arabic content hash: `e3c740f2730048d1f2099d931be60014f62d13f8fdb9617039ca198f63149044`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Documentation and Reproducibility
- English source hash: `4f8c4631a48e724c28caf8bcbc1cd6cef9c26c884f6a18904a2928099025229f`
- Recommended Arabic draft: التوثيق وقابلية إعادة الإنتاج
- Arabic content hash: `9928a1892daefc2c136f4be1305a249e49e2d72d3136a8cd38e91a17b8405bb3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.assessmentBasis`

- Rubric version: `1`
- Entry kind: `assessmentBasis`
- English source: Artifact-Based + Mixed
- English source hash: `02c5838617499be102e68accac4ac2c7404c17b18b56a71a93e070608823392d`
- Recommended Arabic draft: مستندات + مختلط
- Arabic content hash: `f8e13048243e9c4f061fc321ab3c0cf984e5724492865734ab0d559684e90c9e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the Arabic preserves the approved observation/evidence basis without creating a scoring formula.

### `EED-04.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Maintains durable, accurate, and usable documentation that allows others to understand decisions, operate the work, reproduce important results, and continue development.
- English source hash: `618906f32745c89b34479c1d9e9ae77adaf39852ce40964117bf1731288924f7`
- Recommended Arabic draft: يحافظ على توثيق دائم ودقيق وقابل للاستخدام يسمح للآخرين بفهم القرارات، وتشغيل العمل، وإعادة إنتاج النتائج المهمة، ومواصلة التطوير.
- Arabic content hash: `4affdb86c473020700cf002a99d20745335397a6539d626611873c3b1f8b3a07`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.whyItMatters`

- Rubric version: `1`
- Entry kind: `whyItMatters`
- English source: The system depends on continuity, delegation, shared ownership, and AI-assisted work that must remain understandable beyond the original contributor.
- English source hash: `d7adc7cdcbcefe5b7056ea4ae9c3f36c6fc8cdd1a3c20c476df466b7dc3c73a7`
- Recommended Arabic draft: يعتمد النظام على الاستمرارية، والتفويض، والملكية المشتركة، والعمل بمساعدة الذكاء الاصطناعي الذي يجب أن يظل مفهوماً بما يتجاوز المساهم الأصلي.
- Arabic content hash: `0a318869ba4211af1600a88e5aad734c5ba69466e7a04fbce5ceb23d1093d500`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.included`

- Rubric version: `1`
- Entry kind: `included`
- English source: Project/workstream documents; setup and operation; architecture; decision rationale; experiment reproduction; update quality as a sustained practice; handover usability.
- English source hash: `cbfbf161ccebdc24645593b6867f8f0a60dbc2dc445bc1047665582a9cf25757`
- Recommended Arabic draft: مستندات المشروع/مسار العمل؛ الإعداد والتشغيل؛ البنية؛ الأساس المنطقي للقرار؛ إعادة إنتاج التجربة؛ جودة التحديث كممارسة مستدامة؛ قابلية استخدام تسليم المهام.
- Arabic content hash: `bbe840b9bd10eaf4310e2f54bb21b6f0c99eed43af32e2a1cbb0df85617bc16d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.excluded`

- Rubric version: `1`
- Entry kind: `excluded`
- English source: A single update completeness score; writing volume; polished formatting without usable content; communication in meetings.
- English source hash: `10a481ab9707cecb63a862f82c1b2085a01e119e65c0dc6fe33ce69e70b9ff91`
- Recommended Arabic draft: درجة اكتمال تحديث واحد؛ حجم الكتابة؛ التنسيق المصقول بدون محتوى قابل للاستخدام؛ التواصل في الاجتماعات.
- Arabic content hash: `9b12e22cdf5b6666c49399e370bb9dd47cd73f89213f31c913e1634069390ac8`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.evidenceGuidance`

- Rubric version: `1`
- Entry kind: `evidenceGuidance`
- English source: Project/workstream documents; setup guides; architecture diagrams; decision records; handovers; reproducibility results; document version history.
- English source hash: `db42c9b19847602f9915bbcf75b7e383e0f69b98f1f69f3a202baa675e15d50e`
- Recommended Arabic draft: مستندات المشروع/مسار العمل؛ أدلة الإعداد؛ مخططات البنية؛ سجلات القرار؛ تسليم المهام؛ نتائج قابلية إعادة الإنتاج؛ تاريخ إصدار المستند.
- Arabic content hash: `838a7ff20a147030c500431dd39068b9139e6b1b3b229c29eae2c505f4d8784f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Documentation is repeatedly absent, outdated, or unusable, leaving key work dependent on the employee’s memory and making continuation or reproduction difficult.
- English source hash: `3a24f39106b199e5315cd58f043a785473ce45d06cdf69f06a10280c0e1b520f`
- Recommended Arabic draft: التوثيق غائب أو قديم أو غير قابل للاستخدام بشكل متكرر، مما يترك العمل الرئيسي معتمداً على ذاكرة الموظف ويجعل الاستمرار أو إعادة الإنتاج صعباً.
- Arabic content hash: `98a61943a479fd4cb55b23d9b9cd570de0e2b88603a028b2ee3e99d8ad6c1ccd`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-04.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Documents basic information but important decisions, operation steps, or current state are inconsistently maintained and others often need clarification.
- English source hash: `64fdb73776e6e736dfdb7e93896a370f9ec72f4cd093869ba1f91768b0bf47db`
- Recommended Arabic draft: يوثق المعلومات الأساسية ولكن القرارات المهمة، أو خطوات التشغيل، أو الحالة الحالية يتم الحفاظ عليها بشكل غير متسق وغالباً ما يحتاج الآخرون إلى توضيح.
- Arabic content hash: `e246928ffaebd470b889caffc9fd305b1ea0f8f408361071924c4589a7f07ee1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-04.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Maintains documentation that accurately supports understanding, operation, reproduction, and continuation of assigned work.
- English source hash: `aa0f6672f86a0ca05d1c7338a8de04ab8af449e4de5a64d085ae814265947984`
- Recommended Arabic draft: يحافظ على توثيق يدعم بدقة فهم العمل الموكل إليه وتشغيله وإعادة إنتاجه واستمراريته.
- Arabic content hash: `7afc9853a8b2e24af1ae45bf6d65ff2f26cedd39a13780009cad4e9dcaea6083`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-04.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly creates clear, efficient, and reusable documentation that reduces dependency, improves onboarding, and strengthens project continuity.
- English source hash: `63415a6b6f68623b5da3a1c57b02d7cd6f9ecc52418dd9abf988c6872a8645c7`
- Recommended Arabic draft: يخلق بشكل متكرر توثيقاً واضحاً وفعالاً وقابلاً لإعادة الاستخدام يقلل الاعتماد، ويحسن عملية الإعداد (Onboarding)، ويقوي استمرارية المشروع.
- Arabic content hash: `5e676794aac8448424a3462d5bb4e401ae5dfa22ed900b740231992b81ea54ec`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-04.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Establishes exceptional documentation and reproducibility practices that materially improve knowledge continuity across multiple projects or the department.
- English source hash: `b793bf0efd55496dcf3c377b8530c53b263abc6931bede6d95a9c7c62b53e1e5`
- Recommended Arabic draft: يؤسس ممارسات توثيق وإعادة إنتاج استثنائية تحسن بصورة جوهرية استمرارية المعرفة عبر مشاريع أو أقسام متعددة.
- Arabic content hash: `a84b65ee7f0f344ba3c80e5ce1cba58cb52646f4387e9398e38551bc901bbb62`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `EED-04.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Keeps the Workstream document current and provides enough setup and decision context for a delegate to continue.
- English source hash: `2feac3b4dbe18e76120ee48b6ea9cf0f4365452d44eac46646b75ba113e6b753`
- Recommended Arabic draft: التقييم 3: يحافظ على تحديث مستند مسار العمل ويوفر ما يكفي من سياق الإعداد والقرار ليواصله شخص مفوض به.
- Arabic content hash: `7ae3d26f4b418ed2b40a4f113878b0beb47c56ebceb5584c38ab256ada1592cf`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Records why a model was rejected and how the benchmark can be rerun.
- English source hash: `6e0b32d0e0459dff2598cfbb21f033a85afcd07d1f65cdbc6df752e2dfd66640`
- Recommended Arabic draft: التقييم 3: يسجل سبب رفض نموذج وكيف يمكن إعادة تشغيل المعيار المرجعي.
- Arabic content hash: `fd282bdc3beeb452211ef230f56f7a8000c534e865a0c5d0cf2af5d32271c004`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Converts fragmented project knowledge into a concise reusable structure that materially reduces handover time.
- English source hash: `e3ef65de131008f8b46cdf68fb6336b8d0be8719126c30758fb5cb009e8ab4a0`
- Recommended Arabic draft: التقييم 4: يحول معرفة المشروع المجزأة إلى هيكل موجز وقابل لإعادة الاستخدام يقلل بصورة جوهرية من وقت تسليم المهام.
- Arabic content hash: `202e178f10c03e7f1aed8ae17042752e941ec30ae9900409cfb9257bf2ff80ab`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Creates a documentation approach adopted across the department and measurably improves continuity and reproducibility.
- English source hash: `5f44fcac0c88abbf9c62c4c99983d71f112e9ae5c07fafd38fd5beca7c96208a`
- Recommended Arabic draft: التقييم 5: يخلق نهج توثيق يتم تبنيه عبر القسم ويحسن بشكل قابل للقياس الاستمرارية وإمكانية إعادة الإنتاج.
- Arabic content hash: `b3bb9d9d840aa07f16e5553b560dad1d6debd865197d096a7b41d3f063fe0487`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `EED-04.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: A high Documentation Readiness percentage on several updates does not automatically justify a high performance rating.
- English source hash: `7feb77a3a7ff6af9ea9b053781c704129ce832dfb81b52b7ba157700a536067c`
- Recommended Arabic draft: مثال مضاد: نسبة جاهزية التوثيق العالية في عدة تحديثات لا تبرر تلقائياً تقييماً عالياً للأداء.
- Arabic content hash: `73b2bf3952f2ad3eed548af70064db68e5648c9a0a8458ea653ce954c84c9fdd`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Project Contribution
- English source hash: `4e65d9d9dcf5e02d08a41c5ab734b267853b02339396f40bb02cfce907a4567f`
- Recommended Arabic draft: المساهمة في المشروع
- Arabic content hash: `bdd309e00dcfbe3ac4230cbeef899ecab93b15d4a2e2dbd992963d9793a15b91`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.purpose`

- Rubric version: `1`
- Entry kind: `purpose`
- English source: Project Contribution evaluates what the employee actually contributed within the context of active projects and workstreams.
- English source hash: `ef1cd4252cdb593a6f490438b02b6fe4ba71432e6147d2c5fc60ac21827a5ac6`
- Recommended Arabic draft: تقيّم المساهمة الفعلية للموظف ضمن سياق المشاريع ومسارات العمل النشطة.
- Arabic content hash: `53b8e8f250b858e4dffdc498e692df1db5835eb92474e1d75db77fc3ab081d42`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Contribution is repeatedly unclear, substantially incomplete, or below the agreed project/workstream expectations within the employee’s responsibility periods.
- English source hash: `1808ab8ab1d31daf855237f997f700014c4caab9abc015984ff7e1684dc3a80c`
- Recommended Arabic draft: المساهمة غير واضحة بشكل متكرر، أو ناقصة بشكل كبير، أو أقل من توقعات المشروع/مسار العمل المتفق عليها خلال فترات المسؤولية للموظف.
- Arabic content hash: `a6297e470bb2628542887facb911c969e3937a1970fcbd9ae6ba78864d798fac`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PROJECT-CONTRIBUTION.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Some meaningful contribution exists, but important agreed expectations, ownership responsibilities, or delivery quality are inconsistent or require substantial support.
- English source hash: `eb814b97a0d5ec9d9f91896fcff50f32a3bcc7e403094af6ea6e18f4efbb6cdb`
- Recommended Arabic draft: توجد مساهمة ذات مغزى، ولكن التوقعات المتفق عليها المهمة، أو مسؤوليات الملكية، أو جودة التسليم غير متسقة أو تتطلب دعماً كبيراً.
- Arabic content hash: `3e802b7c775b95613f2752f82e38253c3873d27e0ac07bec167ad6f21119f364`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PROJECT-CONTRIBUTION.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Consistently makes the expected contribution across assigned projects and workstreams, appropriately meeting active criteria within the actual context and responsibility period.
- English source hash: `0c2859fe5ff77554eaf70d0a7b7c4b6da4b38b48f21101411894c132b9b4e965`
- Recommended Arabic draft: يقدم باستمرار المساهمة المتوقعة عبر المشاريع ومسارات العمل الموكلة إليه، ويلبي المعايير النشطة بشكل مناسب ضمن السياق وفترة المسؤولية الفعلية.
- Arabic content hash: `4442710ebbdc7f65b3d8a0ddc9fc47431edef638dd24ea836f1711c5c6ba61d5`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PROJECT-CONTRIBUTION.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Repeatedly contributes beyond agreed expectations through strong ownership, high-value decisions, difficult problem resolution, or additional impact across assigned work.
- English source hash: `f0780929570a1cf2f4408f6cc83ff54e37a05a409833f412fbf9830c515771e6`
- Recommended Arabic draft: يساهم بشكل متكرر بما يتجاوز التوقعات المتفق عليها من خلال الملكية القوية، أو القرارات عالية القيمة، أو حل المشكلات الصعبة، أو التأثير الإضافي عبر العمل الموكل إليه.
- Arabic content hash: `9dfd2d5b66db131e25102386f9993c9821fe37415b055087c3722c9a8536f536`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PROJECT-CONTRIBUTION.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional, sustained project impact that materially advances products, clients, reusable capabilities, or department methods beyond normal expectations.
- English source hash: `a48ef38e6188739c38f553f7d06349bcef80c931d842db2d189f3af874933dc1`
- Recommended Arabic draft: يخلق تأثيراً استثنائياً ومستداماً على المشروع يتقدم بصورة جوهرية المنتجات، أو العملاء، أو القدرات القابلة لإعادة الاستخدام، أو طرق القسم بما يتجاوز التوقعات العادية.
- Arabic content hash: `fec0be5bfcf056351c0c8c7ad5bd230c2786800bd1bf432df02af2097be3bbab`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `PROJECT-CONTRIBUTION.prohibitedInputs.1`

- Rubric version: `1`
- Entry kind: `prohibitedInputs`
- English source: Number of projects.
- English source hash: `eedcb95657104435eee6a902802fad836cf8b2d0e4fe701fd15ae4b301ba07eb`
- Recommended Arabic draft: عدد المشاريع.
- Arabic content hash: `ad274ff7029958a1a71716ffd4fd121e8be688cb32f1ee6682c01498dc8b0cc1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.prohibitedInputs.2`

- Rubric version: `1`
- Entry kind: `prohibitedInputs`
- English source: Average project scores.
- English source hash: `f837a6f3692a7810adc6c50e02a2126f63612bc325f499ec9bb16d0cbca22495`
- Recommended Arabic draft: متوسط درجات المشروع.
- Arabic content hash: `cbc682eca84534fc94065e9dd1a32a32100b063a2cc9ba8733c0abb7f062e070`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.prohibitedInputs.3`

- Rubric version: `1`
- Entry kind: `prohibitedInputs`
- English source: Average workstream scores.
- English source hash: `7cc06cde512426eca2094a27e68da269538da5c58848ef21e4f23683cfc23174`
- Recommended Arabic draft: متوسط درجات مسار العمل.
- Arabic content hash: `bba9a21ee38ea41f5537e55c6c62b27241a30cb156280462d7303b4c520ed584`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.prohibitedInputs.4`

- Rubric version: `1`
- Entry kind: `prohibitedInputs`
- English source: Number of dynamic criteria.
- English source hash: `a96c29af1ad470cb286789b78defe37bb830253a74a6d00d549f047276fa3390`
- Recommended Arabic draft: عدد المعايير الديناميكية.
- Arabic content hash: `e60596d1c76c613d6df390e32aea83e8b9a8f3e9978fdd5586b81cf31f49c36a`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.prohibitedInputs.5`

- Rubric version: `1`
- Entry kind: `prohibitedInputs`
- English source: Number of updates.
- English source hash: `fec030100ab356c194a194353b0ac94a0aef899b9d9370f7297a7412198b9b90`
- Recommended Arabic draft: عدد التحديثات.
- Arabic content hash: `a6b5ab751acda8bc6138f5c586efdf24cf1144b08caae7bff4d35945891073e7`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.prohibitedInputs.6`

- Rubric version: `1`
- Entry kind: `prohibitedInputs`
- English source: Evidence count.
- English source hash: `de86dc6f0eed8e1d233828591cb8a19856ac0e768ce8ac4ccc790e67b61aa1dd`
- Recommended Arabic draft: عدد الأدلة.
- Arabic content hash: `9ba1d2d4749f38f896c85093dbaf429716e2cd43d477fcf939793b254a741271`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.prohibitedInputs.7`

- Rubric version: `1`
- Entry kind: `prohibitedInputs`
- English source: Commit count.
- English source hash: `0a1d417e56ab6bad8784fe8eeea7d000f1415d14b12e8d58400cb6ed93564a99`
- Recommended Arabic draft: عدد الالتزامات (Commits).
- Arabic content hash: `2dcffe8d8884f479e2c7c90b1ab875d7d50e72ebd23ebe2dd44c4ad4a8eab1d4`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.1`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Employee responsibility periods.
- English source hash: `e3218e711c2f14dd87d10e38b41e365fbcbc915fe01739177b2430a035447058`
- Recommended Arabic draft: فترات مسؤولية الموظف.
- Arabic content hash: `f7d389f2f303f12bbf7e1a871a7674fb508fbe2d90a952599a845add39f4d6e6`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.2`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Agreed project and workstream criteria active during those periods.
- English source hash: `b65973e9164df98a7f9a493e14ef0ea9b991e410a75990e4b91e4d73c8092a49`
- Recommended Arabic draft: معايير المشروع ومسار العمل المتفق عليها النشطة خلال تلك الفترات.
- Arabic content hash: `1060f377097fa8f4af5a907afa0ba9a2ea75add4d0a9c6814d5bcf81c586a01f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.3`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Work completed individually and collectively.
- English source hash: `41faefeb029f3b79cbf18e67fbe31e1b580ba2572766c721088c44511ae81b8f`
- Recommended Arabic draft: العمل المنجز بشكل فردي وجماعي.
- Arabic content hash: `7bb7345993b812dfdc4f7d3ea523a3c4166544f1f1c10ed4d3c3079e79dae93f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.4`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Actual employee control over outcomes.
- English source hash: `d40aecbae84488f9ff07d8463b1908235079cfb467008e6dc5f5165f7f4c856e`
- Recommended Arabic draft: التحكم الفعلي للموظف في النتائج.
- Arabic content hash: `37994b103fb0659e28eb1b76d0d9effe919c4b4a7dbc21339530e22373c4f2e6`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.5`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: External and organizational blockers.
- English source hash: `ae2ce158363295a9f41d66bd1d1a880db749a33c85bbd84b023cdd931490de51`
- Recommended Arabic draft: العوائق الخارجية والتنظيمية.
- Arabic content hash: `2c9442b01b0639cb501659bdb852111d839c49842bfe4bde5d6e723abb36c081`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.6`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Approved leave and delegation.
- English source hash: `0172520a8938e365079fc66af0d2c318928e5fb722ef100dc8228a50a31ac55c`
- Recommended Arabic draft: الإجازة والتفويض الموافق عليهما.
- Arabic content hash: `bc93637c708411718248210bfdbf38a5ddf23eea2570a7bba43251e38c2dbe86`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.7`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Project stage: research, POC, product, integration, or delivery.
- English source hash: `f7e351c0c10b775a4c8f5dffb26411d9866f7dd4ca13ab99f2ebf5002d696f21`
- Recommended Arabic draft: مرحلة المشروع: بحث، POC، منتج، تكامل، أو تسليم.
- Arabic content hash: `efa2a269be0dc0f304d459e96b7684ff96ffcab4f672fcca7b6b20064003772f`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.8`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Attribution status.
- English source hash: `e6781b62c5e5fa5c246506880dc68517415f8d26462da1bba196f3480ff78213`
- Recommended Arabic draft: حالة الإسناد (Attribution).
- Arabic content hash: `046f30e0aaa94d76209b29fa15b6c36357b127d79e2df0e215c0a1a1ea92af8a`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.9`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Material decisions and results.
- English source hash: `723fab04a68de434afa34bdc225c2d63540de4aab7ed696b865c0439535e8d90`
- Recommended Arabic draft: القرارات والنتائج الجوهرية.
- Arabic content hash: `95e0cb563a911405502274410ee42c5646d815d45ad830b2855acbe7527a1ab8`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.requiredContextReview.10`

- Rubric version: `1`
- Entry kind: `requiredContextReview`
- English source: Whether the employee created durable value beyond visible output.
- English source hash: `d6de5a44161c0e0c72e236cef4131ea21053dc951d4303ede82a1428fb64f601`
- Recommended Arabic draft: ما إذا كان الموظف قد خلق قيمة دائمة تتجاوز المخرجات المرئية.
- Arabic content hash: `d859825cec4c53461fca564705ff2ff87aa4f5566221360c67e379199ceac635`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.example.1`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 3: Reliably fulfills the expected contribution across assigned workstreams, meets the active criteria, and maintains clear responsibility and evidence.
- English source hash: `40d8e04582bc7bb4fc9aee16be46d583a328fa68d412e36e1d80a8887fb612af`
- Recommended Arabic draft: التقييم 3: يفي بصورة موثوقة بالمساهمة المتوقعة عبر مسارات العمل المكلّف بها، ويستوفي المعايير النشطة، ويحافظ على وضوح المسؤولية والأدلة.
- Arabic content hash: `f7ff1b885e719900ff8a4893e71eff49d94a7a4c9cb59ed63920c25f5a9cc0bd`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.example.2`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 4: Repeatedly exceeds agreed expectations through difficult problem resolution, strong ownership, integration impact, or valuable decisions beyond normal delivery.
- English source hash: `0ff27aa8efbd4deaf2289cc17606eb8ddba26b40ca3050b39717879eda99d9c1`
- Recommended Arabic draft: التقييم 4: يتجاوز التوقعات المتفق عليها مراراً من خلال حل المشكلات الصعبة، أو الملكية القوية، أو أثر التكامل، أو اتخاذ قرارات قيّمة تتجاوز التسليم المعتاد.
- Arabic content hash: `ab03834244415210b6b54c55f493f6293fd456bf181c77d2205ce6f071bcaa1d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.example.3`

- Rubric version: `1`
- Entry kind: `example`
- English source: Rating 5: Creates sustained project impact that materially advances products, reusable capability, major client outcomes, or department methods across more than one context.
- English source hash: `19298378b0dde9c9dcb6019f99b54697a8f8f61fc15dc44ce6bbc58edb024adf`
- Recommended Arabic draft: التقييم 5: يحقق أثراً مستداماً في المشروع يطوّر بشكل جوهري المنتجات، أو القدرات القابلة لإعادة الاستخدام، أو نتائج رئيسية للعملاء، أو أساليب القسم عبر أكثر من سياق واحد.
- Arabic content hash: `6e5a79aeb9aac849c78282f57cdf83f99a2081c68ec9adcc4cf3ec3aaf3e2335`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.example.4`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Completing many small POCs does not automatically justify a higher rating than making a strong contribution to one long-term product.
- English source hash: `8e6a92627d9d5ef1b3cc59e8070051078a2ea0571622c795c67db511796527b0`
- Recommended Arabic draft: مثال مضاد: لا يبرر إنجاز عدد كبير من مشاريع POC الصغيرة تلقائياً تقييماً أعلى من تقديم مساهمة قوية في منتج واحد طويل الأمد.
- Arabic content hash: `ad20441aa5bf1f4be396e86107b73ae00c72682c5d0b4142162bd45ce86a023d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `PROJECT-CONTRIBUTION.example.5`

- Rubric version: `1`
- Entry kind: `example`
- English source: Anti-example: Being Primary Owner does not automatically justify more credit than Contributors.
- English source hash: `df611932463b277bc9200cf851d81abae49b9a96824feb82a2d4627141dbe366`
- Recommended Arabic draft: مثال مضاد: لا يبرر كون الموظف المالك الأساسي تلقائياً منحه تقديراً أكبر من المساهمين.
- Arabic content hash: `902ca3cad20a2978dc8a7c12cd5162f00849fac7abdfd6d5e720ced861ef88f0`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-01.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Direction and Priority Clarity
- English source hash: `43e6547aad2dd8af84e6d4e9f52ccfe4f05dd416d3927864b8699c4d45b0e9b1`
- Recommended Arabic draft: وضوح التوجيه والأولويات
- Arabic content hash: `41b740b0aca1720a6391625a49b60803ace140a451b94c22fd2eb1b38b8d943d`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-01.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Provides understandable direction, translates wider goals into useful priorities, and helps the team distinguish what matters now from what can wait.
- English source hash: `0c77240afbfddbf91420d8b36e08b80075818e7ad869fc75f081b094a395b5a8`
- Recommended Arabic draft: يوفّر توجيهاً مفهوماً، ويترجم الأهداف الأوسع إلى أولويات مفيدة، ويساعد الفريق على التفريق بين ما يهم الآن وما يمكن تأجيله.
- Arabic content hash: `b66340ba73f5749432845a0e94764a28060231567c4aa89022e31547b3aaaccd`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-01.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Direction and priorities are repeatedly unclear or contradictory, causing substantial confusion, rework, or unmanaged switching.
- English source hash: `964a9e6cbed1e98622651b3f57a90d0274a17e8126583016c5bec943bcf4fbed`
- Recommended Arabic draft: التوجيه والأولويات غير واضحة أو متناقضة بشكل متكرر، مما يتسبب في ارتباك كبير، وإعادة عمل، أو تحوّل غير مُدار.
- Arabic content hash: `54139dfcb975472a485c16c76ab3aa972084cd1ac09b2239d24d8ec6383ef840`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-01.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Provides some direction, but priorities or expectations are often unclear, late, or changed without enough context.
- English source hash: `c5ba968e85d0daec0ad265b883d7919caebbd2fe2ca3a8e1eede07d9a6ac9119`
- Recommended Arabic draft: يوفّر بعض التوجيه، لكن الأولويات أو التوقعات غالباً ما تكون غير واضحة، أو متأخرة، أو تتغير دون سياق كافٍ.
- Arabic content hash: `ee9714ff5aa832581c8c31730dec15dfb2301cb2b229f311e9fdba11dbbcb686`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-01.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Usually provides clear direction and priorities, explains material changes, and helps the team understand expected outcomes.
- English source hash: `0ce9171ac7d0e87dcb4a43612ce53fb60e64ee27a573ee733edbb00b51a87301`
- Recommended Arabic draft: عادةً ما يوفّر توجيهاً وأولويات واضحة، ويشرح التغييرات الجوهرية، ويساعد الفريق على فهم النتائج المتوقعة.
- Arabic content hash: `be605957701be7811f677cc19a5922d629fd22b90cf9ba11d93d50ef813f7068`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-01.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Consistently creates strong clarity in ambiguous situations, aligns competing priorities, and reduces avoidable rework.
- English source hash: `15852fc21fa50af88d9b5e22dd45349fbc44f32876e225856283014e4727d236`
- Recommended Arabic draft: يخلق باستمرار وضوحاً قوياً في المواقف الغامضة، ومواءمة الأولويات المتنافسة، وتقليل إعادة العمل التي يمكن تجنبها.
- Arabic content hash: `409e5352801d09d079fd856ee1489513da489a01012769bf7a8a424379dd8155`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-01.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional strategic clarity that materially improves team focus, product direction, and decision quality over time.
- English source hash: `c5d74a4fba55e41be5bda3b9e1d2ee771e3878498e3049a814157e88cbead377`
- Recommended Arabic draft: يخلق وضوحاً استراتيجياً استثنائياً يحسّن بصورة جوهرية تركيز الفريق، وتوجيه المنتج، وجودة القرار بمرور الوقت.
- Arabic content hash: `1705661809475f911f9c7a944f85207d591dc55b17cfc178d8de8a1ddec4a916`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-01.commentPrompt`

- Rubric version: `1`
- Entry kind: `prompt`
- English source: What repeated management behavior helped or reduced clarity and focus? Give a specific work-related example when useful.
- English source hash: `60321799ec72cf8b6ed30e1bb0973341382495318eae788fe6eb96b014a7bf7d`
- Recommended Arabic draft: ما السلوك الإداري المتكرر الذي ساعد أو قلل من الوضوح والتركيز؟ أعط مثالاً محدداً متعلقاً بالعمل عند الاقتضاء.
- Arabic content hash: `eaaffe1162c2854517a0d7543934d168eba538b612477617d3206a8520c14ce1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the prompt is clear to employees and does not imply anonymity in Identified mode.

### `MGR-02.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Support, Barrier Removal, and Team Protection
- English source hash: `e74f1bf88af458504795852e192b4d70c75ed4758d4f6c3a0637a042cf4f0734`
- Recommended Arabic draft: الدعم، وإزالة العوائق، وحماية الفريق
- Arabic content hash: `ee4928cba74b623ee57951a434e7a655ac6b74a8890cf556d7abedbc7e72ed48`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-02.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Enables employees to work effectively by removing organizational blockers, obtaining needed decisions or access, and protecting the team from avoidable disruption.
- English source hash: `3163853f96a16a79bffa96487b825eebaf9f4d5d31d0c8542c0053bd51212bbe`
- Recommended Arabic draft: يمكّن الموظفين من العمل بفعالية عن طريق إزالة المعوقات التنظيمية، والحصول على القرارات أو الوصول اللازم، وحماية الفريق من التعطيل الذي يمكن تجنبه.
- Arabic content hash: `923e0f51b6e1b9a29f4178023427f9f655feec77b4409a57e69eb29101aeab03`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-02.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Regularly leaves major barriers unresolved, adds avoidable disruption, or fails to support the team in critical situations.
- English source hash: `126854869bbe58dee941dddc272a0998a1234d218d2c94d0772bb29867b7ddab`
- Recommended Arabic draft: يترك بشكل منتظم معوقات رئيسية دون حل، ويضيف تعطيلاً يمكن تجنبه، أو يفشل في دعم الفريق في المواقف الحرجة.
- Arabic content hash: `e268d88d2206e9273861acf8c2f6fe15924ee6f52991bda1d2d45704e1398948`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-02.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Provides support inconsistently; important blockers often remain too long or escalation occurs only after significant impact.
- English source hash: `737f5e7bb4ae3a6a7a11704af3681fe3ed05be69eb2a5883d3db305f30d2416b`
- Recommended Arabic draft: يوفّر الدعم بشكل غير متسق؛ وغالباً ما تبقى المعوقات المهمة لفترة طويلة جداً أو يحدث التصعيد فقط بعد تأثير كبير.
- Arabic content hash: `df847f2c1fb16c66d32ce6846e48ba4b4414677261dbf05d83654a78f0e292b1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-02.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Provides appropriate support, escalates meaningful blockers, and protects the team from unnecessary operational disruption.
- English source hash: `1955e55d7ba1d68004d0589f402b8404ee6f19d8254a581607fed14bddc18b85`
- Recommended Arabic draft: يوفّر دعماً مناسباً، ويصعّد العوائق الهامة، ويحمي الفريق من التعطيل التشغيلي غير الضروري.
- Arabic content hash: `02f8b03b916b88c724d5e67b04697cc715aeb4500373ed443e3afb156289f5dd`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-02.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Anticipates and removes significant barriers early, manages stakeholders effectively, and repeatedly improves team operating conditions.
- English source hash: `6b8a0936739643205f71bfd3c2f587afa7cf08aca9136ebaa0137c4a510668fe`
- Recommended Arabic draft: يتوقع ويزيل المعوقات الكبيرة مبكراً، ويدير أصحاب المصلحة بفعالية، ويحسن باستمرار ظروف تشغيل الفريق.
- Arabic content hash: `81c699a4b86be661c18eb810222acb4fa6eb3bf02eda4e09ebc415f9f82128ba`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-02.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional organizational leverage that materially increases the team’s ability to deliver, experiment, and sustain high-quality work.
- English source hash: `522c302fb6abe288f35d128d778f5ca99d07a31429eff2b7b139a4653f5e56d0`
- Recommended Arabic draft: يخلق أثراً تنظيمياً مضاعفاً واستثنائياً تزيد بصورة جوهرية من قدرة الفريق على تقديم العمل، والتجريب، والحفاظ على جودة عالية.
- Arabic content hash: `bad7dd35b8565143610d767c2f4604720bbe96ae881fb1eefeb2a5f8c2abd178`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-02.commentPrompt`

- Rubric version: `1`
- Entry kind: `prompt`
- English source: What repeated behavior helped remove or created barriers for the team? Explain the effect on your work or the team.
- English source hash: `aba1df2218f6c0af58e9249a44fd255e8bfcd61afab6bbdec6a946b54a22db74`
- Recommended Arabic draft: ما السلوك المتكرر الذي ساعد في إزالة أو خلق عوائق للفريق؟ اشرح التأثير على عملك أو عمل الفريق.
- Arabic content hash: `f3404d732b900d88bd1a6e5f1c6fdffc1c35808ebeb63d6ac3e73ceaba43b722`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the prompt is clear to employees and does not imply anonymity in Identified mode.

### `MGR-03.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Communication, Listening, and Psychological Safety
- English source hash: `a0a577554e35ea6f1125a2e9c63604878990cad510c3fdba08f391ec145f33df`
- Recommended Arabic draft: التواصل، والاستماع، والأمان النفسي
- Arabic content hash: `cadedadbf3ee485ef1a7dba4ac9431e64d5dba8238067fc37e330a667fabeefe`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-03.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Communicates openly, listens seriously, invites professional disagreement, and maintains an environment where employees can raise risk, failure, uncertainty, and concerns without inappropriate retaliation.
- English source hash: `42273df65ffec960d4d6a45d7d932960c1e48a1af4fbddf2985815e95286d009`
- Recommended Arabic draft: يتواصل بانفتاح، ويستمع بجدية، ويدعو إلى الاختلاف المهني، ويحافظ على بيئة يمكن للموظفين فيها طرح المخاطر والفشل والشكوك والمخاوف دون انتقام غير مناسب.
- Arabic content hash: `b0c0d29c2d4e965cd409a36b4924d7363f28efea49990df2e61b55e78716d1e1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-03.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Communication discourages honesty or disagreement, important concerns are dismissed, or employees reasonably fear negative consequences for speaking openly.
- English source hash: `052202aee9954ad65464b6ffb7549a63dd7ccc9bc7e5a5f9921175c966209475`
- Recommended Arabic draft: يُثبّط التواصل الصدق أو الخلاف، وتُتجاهل المخاوف المهمة، أو يخشى الموظفون بشكل معقول عواقب سلبية للتحدث بانفتاح.
- Arabic content hash: `03b4bea046658ef048adb1ce08d848d29cfb51d857e95b19ccdf08ff5ff4029b`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-03.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Listens and communicates in routine situations but reacts inconsistently to challenge, failure, or difficult feedback.
- English source hash: `6d72ee70838f91aa36f7d4a459e769c8d1ec34e8ae4313cdb95583c25e269c3f`
- Recommended Arabic draft: يستمع ويتواصل في المواقف الروتينية ولكن يتفاعل بشكل غير متسق مع التحدي أو الفشل أو التعليقات الصعبة.
- Arabic content hash: `80092e7525c1f6727ab86fe204abffd7850eb6b24d520496676114738803502a`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-03.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Communicates respectfully, listens to concerns, accepts professional disagreement, and allows employees to discuss mistakes and uncertainty.
- English source hash: `b2a9d24a485072114b5481d80f793f4b95f7874c41c190ce7fe616f27d86330c`
- Recommended Arabic draft: يتواصل باحترام، ويستمع إلى المخاوف، ويتقبل الاختلاف المهني، ويتيح للموظفين مناقشة الأخطاء والشكوك.
- Arabic content hash: `661e661ab842592bedcf8cc5a99451ab139a105172b8f6eeabd9e923bb29e869`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-03.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Actively creates trust, responds constructively to difficult feedback, and repeatedly improves the quality and openness of team discussion.
- English source hash: `0bde8779675bd1627bafa14af96407d3db642e58df43df4fe05b39ef61e8220b`
- Recommended Arabic draft: يخلق بنشاط الثقة، ويتجاوب بشكل بناء مع التعليقات الصعبة، ويحسن باستمرار جودة وانفتاح نقاش الفريق.
- Arabic content hash: `4e172d9490548c7b5777c62574093a086a547ffe726850cb7678e4f9d3817bd3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-03.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional psychological safety and honest dialogue that materially improves learning, risk detection, and team decision-making.
- English source hash: `cc4460755b38065470b75eebfcbd56433508e9aaccb284c6267429a108174336`
- Recommended Arabic draft: يخلق أماناً نفسياً وحواراً صادقاً استثنائيين يحسّن بصورة جوهرية التعلم واكتشاف المخاطر واتخاذ القرار في الفريق.
- Arabic content hash: `341683771b3bc7d1e7a21a1af6c83ed01e11bba39db531f6063382bcd2f6c6b3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-03.commentPrompt`

- Rubric version: `1`
- Entry kind: `prompt`
- English source: How safe and useful is communication with the manager over time? Explain what behavior should continue or change.
- English source hash: `b9d52322052b6391651d732221b2527c259119c57eb5bb5d2058b224c90657fc`
- Recommended Arabic draft: ما مدى أمان وفائدة التواصل مع المدير بمرور الوقت؟ اشرح ما هو السلوك الذي يجب أن يستمر أو يتغير.
- Arabic content hash: `2235acb59c9aa29dc9b66515153f17400eb81bd568522eb6991ce9834d4afad0`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the prompt is clear to employees and does not imply anonymity in Identified mode.

### `MGR-04.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Delegation, Fairness, and Recognition
- English source hash: `9fdf6a456189370edd26512523c296e34ca9287e9524ff4bc34b8ce8d40983f1`
- Recommended Arabic draft: التفويض، والإنصاف، والتقدير
- Arabic content hash: `1ffc26049573ea19d701bf2af78fe49ca271a7e383ad292c79fa487f508cd0d1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-04.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Delegates with appropriate trust, applies expectations fairly, gives credit accurately, and avoids unnecessary micromanagement.
- English source hash: `91e7200d82bc204bff8b262990fb9abda840cc1f08042866648a8f5bb7443d12`
- Recommended Arabic draft: يفوّض بثقة مناسبة، ويطبق التوقعات بإنصاف، ويعطي الفضل بدقة، ويتجنب الإدارة التفصيلية غير الضرورية.
- Arabic content hash: `b79fdc6344807b1fba27dc755f547b16e901657907063916906c8818c7dc5e69`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-04.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Delegation, recognition, or treatment is repeatedly unfair, controlling, or inconsistent, materially damaging trust or ownership.
- English source hash: `932321191bcbe891c818080e1e6bdeb743cead24beaeb1d3823365386a7d2ea5`
- Recommended Arabic draft: التفويض أو التقدير أو المعاملة غير عادلة بشكل متكرر، أو مسيطرة، أو غير متسقة، مما يضر بالثقة أو الملكية بصورة جوهرية.
- Arabic content hash: `9ffde4b64b83e12ee47d3360793680cc82fe082536aeab01761f983acb134ba1`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-04.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Delegates or recognizes contribution inconsistently; expectations or treatment sometimes appear unclear or uneven.
- English source hash: `1cc36e0209ec79c8ac0367cd5a2384cccb0d6bfb7ac4cfec030da23d1cb29b0e`
- Recommended Arabic draft: يفوّض أو يعترف بالمساهمات بشكل غير متسق؛ وقد تبدو التوقعات أو المعاملة أحياناً غير واضحة أو غير متكافئة.
- Arabic content hash: `91dfbfefcafcc49bce95d90cd1809b6790993ca4310b2f652f965321bbf4cd6c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-04.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Delegates appropriately, treats employees fairly, recognizes meaningful contribution, and avoids unnecessary control.
- English source hash: `7648a6220f2c2196ac962a5527d5197b0e73b91bc5123a48c8845374add8774d`
- Recommended Arabic draft: يفوّض بشكل مناسب، ويعامل الموظفين بإنصاف، ويقدّر المساهمات الهادفة، ويتجنب التحكم غير الضروري.
- Arabic content hash: `098629a43c8dc334cfa252d4844415374e8bf895bdd6c5833e8d9547eaf85977`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-04.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Consistently strengthens ownership through trust, fair decisions, and accurate recognition while maintaining needed accountability.
- English source hash: `805b10aca55ac81c17bfe33a9b0ebbeec9a83e01c4fa4793816b21dc7b9a801d`
- Recommended Arabic draft: يقوي باستمرار الملكية من خلال الثقة والقرارات العادلة والتقدير الدقيق مع الحفاظ على المساءلة اللازمة.
- Arabic content hash: `d5277fc035c33b3f1b289027de6c7b161fc3fb0b59c5e3a6e6c2a7690d10f216`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-04.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates an exceptional culture of trust, fairness, and ownership that materially improves initiative, retention of knowledge, and team performance.
- English source hash: `9fee7412eb41cba88bac0408cd7ad5b751f97872999056f7c9219d2c2eee99c6`
- Recommended Arabic draft: يخلق ثقافة استثنائية للثقة والإنصاف والملكية تحسن بصورة جوهرية المبادرة، والاحتفاظ بالمعرفة، وأداء الفريق.
- Arabic content hash: `504ea7ea5fc368bbe263a1e4315031e57d6b35d468b3836e4dd7f3b6ce2bbf9c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-04.commentPrompt`

- Rubric version: `1`
- Entry kind: `prompt`
- English source: What repeated behavior affected trust, fairness, delegation, or recognition? Give the context needed to understand your rating.
- English source hash: `dae8f0e676a735f87fc7e00ffb831e965bb05a386c6fded32e1fb755e1de5d74`
- Recommended Arabic draft: ما السلوك المتكرر الذي أثر على الثقة أو الإنصاف أو التفويض أو التقدير؟ أعط السياق اللازم لفهم تقييمك.
- Arabic content hash: `3a48d6ae24d931cf9069132c6b88c85fb6c6dac7d820396cbcae85e04a43e11c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the prompt is clear to employees and does not imply anonymity in Identified mode.

### `MGR-05.title`

- Rubric version: `1`
- Entry kind: `title`
- English source: Feedback, Development, and Innovation Support
- English source hash: `589886af31cc1742b8b57785c4e84418abe3d3bbca715c4968ff61bbbf1b8985`
- Recommended Arabic draft: التغذية الراجعة، والتطوير، ودعم الابتكار
- Arabic content hash: `124a7fe5f6cb15b5e03347126a1441d5c530d1009e384121123ab020a554e164`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-05.definition`

- Rubric version: `1`
- Entry kind: `definition`
- English source: Provides useful feedback, supports employee growth, and creates room for research, experimentation, learning, and responsible innovation.
- English source hash: `9e3689bc2bb2f77b90759758cbac740bf237b395d4e8f22d5ca29b8133ba5055`
- Recommended Arabic draft: يوفّر تغذية راجعة مفيدة، ويدعم نمو الموظف، ويخلق مساحة للبحث والتجريب والتعلم والابتكار المسؤول.
- Arabic content hash: `ad4f7fa3d5facafba045875b846e54da5e92ce4a3baabcc0d5ac34de59c04c63`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the recommended Arabic wording preserves the complete approved English meaning.

### `MGR-05.anchor.1`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Rarely provides useful feedback or development support and repeatedly discourages learning, experimentation, or employee growth.
- English source hash: `59c743b0d899b997a8d90f482c88a0436a5009812f419684a0e4f283b38c18bc`
- Recommended Arabic draft: نادراً ما يوفّر تغذية راجعة أو دعماً للتطوير مفيداً، ويثبّط بشكل متكرر التعلم أو التجريب أو نمو الموظف.
- Arabic content hash: `aa54967adc370892357e55d66c0f87fe07f73aa913770e97c8e180890c64509e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-05.anchor.2`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Provides occasional feedback and support, but it is often late, general, or disconnected from practical development.
- English source hash: `02f7fb6ebbf554d314c23e2a0af6f43e1b75c4be76854cd29ad02af8661c7d89`
- Recommended Arabic draft: يوفّر تغذية راجعة ودعماً عرضياً، ولكنه غالباً ما يكون متأخراً، أو عاماً، أو منفصلاً عن التطور العملي.
- Arabic content hash: `c3a06f9a542bb488b217c4307d7e2603a217f9c149f758a41aff0c94c2247b5b`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-05.anchor.3`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Provides timely, useful feedback, supports reasonable development actions, and allows responsible research and experimentation.
- English source hash: `a90136eaed7253aba17cf5b0400ce0cd1bf30028a97637aed454bcaf577a5d2b`
- Recommended Arabic draft: يوفّر تغذية راجعة مفيدة وفي الوقت المناسب، ويدعم إجراءات التطوير المعقولة، ويسمح بالبحث والتجريب المسؤول.
- Arabic content hash: `2cca7135eb897e6d608500354032dadd4e4e09bb269b38bb19784fc6784b3e58`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-05.anchor.4`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Consistently coaches employees, connects development to real work, and creates strong conditions for learning and innovation.
- English source hash: `df8dbb468e2ccba6dd01738a6b50a811e648c3270ea34ee3c1cf9cb1b8d6096c`
- Recommended Arabic draft: يُدرّب الموظفين باستمرار، ويربط التطور بالعمل الحقيقي، ويخلق ظروفاً قوية للتعلم والابتكار.
- Arabic content hash: `90ad6236c58c82dddbf18f958ec4cab51b41fce42a6868549f30cd1a2e0a9dd2`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-05.anchor.5`

- Rubric version: `1`
- Entry kind: `anchor`
- English source: Creates exceptional sustained growth and innovation capability, materially raising employee development and the department’s ability to learn and adapt.
- English source hash: `95c59210fd16bd4a4ab0486c2ca3937ac9f921d9054624c10394d85df9775812`
- Recommended Arabic draft: يخلق قدرة استثنائية ومستدامة على النمو والابتكار، مما يرفع بصورة جوهرية من تطوير الموظف وقدرة القسم على التعلم والتكيف.
- Arabic content hash: `3c1c539147da4d33963fb5ba15fd4ba2393bff63141260c1abb64fae70988377`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm this rating meaning remains distinct from both adjacent anchors and preserves the English impact threshold.

### `MGR-05.commentPrompt`

- Rubric version: `1`
- Entry kind: `prompt`
- English source: What repeated behavior supported or limited feedback, growth, learning, or innovation? Explain what would improve the experience.
- English source hash: `d6b7f5e18176f71508ad3a8365ce777a1485a6e6b190c54b3b49efb2ccedc75d`
- Recommended Arabic draft: ما السلوك المتكرر الذي دعم أو حدّ من التغذية الراجعة أو النمو أو التعلم أو الابتكار؟ اشرح ما الذي سيحسن التجربة.
- Arabic content hash: `7ee49b16c1dcbfaf949a929cb88f85e8b3507c58d6226c7defe526d8a9406362`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the prompt is clear to employees and does not imply anonymity in Identified mode.

### `bias-guidance.1`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Recency bias | Recent work dominates the rating | What pattern appears across the full period?
- English source hash: `aef3a9398cfd733f2db90c884505f1446823092959be52b9a5e442a34836d829`
- Recommended Arabic draft: تحيز الحداثة | يسيطر العمل الأخير على التقييم | ما النمط الظاهر عبر الفترة الكاملة؟
- Arabic content hash: `376fd083123b99f69458e4231e8327cffb944a7972080f4c48c4beef6aca75b8`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.2`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Halo effect | One strength raises all ratings | What independent evidence supports this criterion?
- English source hash: `7874726641852153e1a380e8c8689f81b4da6298eab611ffb761c667c6b84465`
- Recommended Arabic draft: تأثير الهالة | قوة واحدة ترفع جميع التقييمات | ما الدليل المستقل الذي يدعم هذا المعيار؟
- Arabic content hash: `030f33ac060f30203ba77ae86341f65b2455ca79be86e0cfe76f597475f854c3`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.3`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Horn effect | One weakness lowers unrelated ratings | Is this behavior relevant to this criterion?
- English source hash: `e76eff2f9093b6fa8fe1a92e6ddc42cff892d4e274a2b50ba81ab9cb4fc32493`
- Recommended Arabic draft: تأثير القرون | ضعف واحد يخفض التقييمات غير ذات الصلة | هل هذا السلوك ذو صلة بهذا المعيار؟
- Arabic content hash: `60724efb64dd1d93434bdb359f2c478f13b36ed1187e56d46318a5c6f619dd54`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.4`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Visibility bias | Client-facing or vocal work appears more valuable | What less visible work created equivalent or greater value?
- English source hash: `f0c259509d1123c9e471f6055c6decb545a068469861d7233a8383cf6db295c3`
- Recommended Arabic draft: تحيز الرؤية | العمل الظاهر للعملاء أو الصوتي يبدو أكثر قيمة | ما العمل الأقل وضوحاً الذي خلق قيمة مكافئة أو أكبر؟
- Arabic content hash: `3b8c6f597bcf3dda919c5f9258265bf2484f3ae1fcf50363351613708d22475b`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.5`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Similarity bias | Manager favors employees with similar style | Would the rating change if the same result came from a different personality?
- English source hash: `ed0803b59caa3e205343925e3bd18f285b322d9029e39f20884c95c226dfccb1`
- Recommended Arabic draft: تحيز التشابه | المدير يفضل الموظفين ذوي الأسلوب المماثل | هل سيتغير التقييم إذا جاءت النتيجة نفسها من شخصية مختلفة؟
- Arabic content hash: `7a8099e29533eb3e25b50e4d39dc9ad1d6ba4cc87c3297c59f0df4b8e8a74309`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.6`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Extroversion bias | Sociability is mistaken for collaboration | What observable team contribution occurred?
- English source hash: `0e842df77ad14520308ca3f97da1960212dc616078bb9983b4f398c59cb68c7e`
- Recommended Arabic draft: تحيز الانبساطية | يُخطأ في اعتبار الاجتماعية تعاوناً | ما المساهمة القابلة للملاحظة للفريق التي حدثت؟
- Arabic content hash: `41ed6fc3e35520fb6d06da784c4dd5669fe23079aa91778412433b27a605ba4a`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.7`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Project prestige bias | Large client project is rated above internal product work | What was the employee’s actual responsibility and impact?
- English source hash: `146d1b2a33a9993ac1bcb546acae6d2434d71c867e4458171f10abfc3d450db7`
- Recommended Arabic draft: تحيز هيبة المشروع | يتم تقييم مشروع العميل الكبير أعلى من عمل المنتج الداخلي | ما هي المسؤولية والتأثير الفعلي للموظف؟
- Arabic content hash: `40cca2dcd1e8ed3be73191a65ce15f85e078ea0728690246103b36f0d9f0df4e`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.8`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Outcome bias | Final success hides poor method, or failure hides strong method | What was within the employee’s control and how sound was the process?
- English source hash: `2f1b4197f3d1409a8d99b3de4fcb842529014e046de6383d972ced9188c9d068`
- Recommended Arabic draft: تحيز النتيجة | النجاح النهائي يخفي المنهج السيئ، أو الفشل يخفي المنهج القوي | ما الذي كان تحت سيطرة الموظف ومدى سلامة العملية؟
- Arabic content hash: `ab80752befdd08843d0112ca2feaf24c15bb5308d2cd6bb7202c306850dab807`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.9`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: AI fluency bias | Fast agent use is mistaken for engineering quality | Did the employee direct, review, validate, and own the output?
- English source hash: `f48c25e37369243be841530556ce0bea91fd9edc06d579cc039cea859dca907a`
- Recommended Arabic draft: تحيز الطلاقة في استخدام AI | يُخطأ في اعتبار استخدام الوكيل السريع بجودة الهندسة | هل وجه الموظف، راجع، تحقق، وامتلك الناتج؟
- Arabic content hash: `d0fc0d65faaa8b85b54448737d59488dac519b270c7dc08682471bd81865655c`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.10`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Effort-impact confusion | Long hours are mistaken for effectiveness | What useful outcome, learning, or risk reduction resulted?
- English source hash: `37f98d9b1d3fec0c1e3db3f8bf133ef61e6e762dff761c51e38de93c0778bb9f`
- Recommended Arabic draft: الخلط بين الجهد والتأثير | ساعات العمل الطويلة تُخطأ بها على أنها فعالية | ما النتيجة المفيدة أو التعلم أو تقليل المخاطر الذي نتج عنه؟
- Arabic content hash: `ba431a5f0385f8cbe578f6a32a9716380bc970d28e88384d02271c899afd2a2a`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.11`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Team-credit inflation | Whole project success is copied to every member | What did this employee contribute during their responsibility period?
- English source hash: `4d9953af048d87ef14e40cd833c8c98accf7d9fbb4d805eec78e66abb2cc15fa`
- Recommended Arabic draft: تضخم الفضل الجماعي | نجاح المشروع بالكامل يُنسخ لكل عضو | ما الذي ساهم به هذا الموظف خلال فترة مسؤوليته؟
- Arabic content hash: `df49788dc3a306cbadeefb310d4ab1505feae5cee14ba25d213ed9d00e15ab72`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.12`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Leave bias | Approved absence reduces perceived reliability | Was the responsibility properly handed over and excluded from the period?
- English source hash: `8ccaface990c34aa709ad1a754c36bdb73079e02cdca02e477d1c438cad5fe27`
- Recommended Arabic draft: تحيز الإجازة | الغياب الموافق يقلل من الموثوقية المتصورة | هل تم تسليم المسؤولية بشكل صحيح واستبعادها من الفترة؟
- Arabic content hash: `7d29e9a9a3343cd4485fb8f317aeb9f0707463f227c46a23f23366f627185906`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.13`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Documentation-volume bias | More records imply better performance | Does the documentation create clarity, continuity, or reproducibility?
- English source hash: `6389eee33a6ef826c9ad72a6e2ca73b86712e1a985bd58fdf901b4ad655a587f`
- Recommended Arabic draft: تحيز حجم التوثيق | المزيد من السجلات تعني أداء أفضل | هل يخلق التوثيق وضوحاً، أو استمرارية، أو قابلية للاستنساخ؟
- Arabic content hash: `3ade2ec4769a01a882a3778c186fbb0c5ce71446cca1899ed5a97d0beb76a862`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.14`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: One-incident bias | One mistake defines the rating | Is this a repeated pattern or an isolated event?
- English source hash: `04728b8260aa3c4a05cffb95ea4701b5ba10d285c2efb615a741b76c1d513d32`
- Recommended Arabic draft: تحيز الحادثة الواحدة | خطأ واحد يحدد التقييم | هل هذا نمط متكرر أم حدث معزول؟
- Arabic content hash: `b52a7411b68ad0c8984d2b5e449dff930eaa51e1fd51141a577dea8d260ced37`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.

### `bias-guidance.15`

- Rubric version: `1`
- Entry kind: `bias-guidance`
- English source: Self-promotion bias | Strong narration receives more credit | What do the records, outcomes, and observed behavior support?
- English source hash: `f51fff7d2ded4ab32de4d974940d08ba3566b60f74279582cd1595169366ec7a`
- Recommended Arabic draft: تحيز الترويج الذاتي | السرد القوي يحصل على المزيد من الفضل | ما الذي تدعمه السجلات، والنتائج، والسلوك الملاحظ؟
- Arabic content hash: `b9ca36a26d422c229f09c9df1edc36551889c30fd7d8a858eb5e9df2caa0e2c0`
- Subject-matter disposition: `UNRESOLVED`
- Subject-matter reviewer identity: _Not supplied — unresolved._
- Subject-matter reviewer kind: _Not supplied — unresolved._
- Subject-matter reviewed-at (UTC): _Not supplied — unresolved._
- Employee-comprehension disposition: `UNRESOLVED`
- Employee-comprehension reviewer identity: _Not supplied — unresolved._
- Employee-comprehension reviewer kind: _Not supplied — unresolved._
- Employee-comprehension reviewed-at (UTC): _Not supplied — unresolved._
- Semantic note: Confirm the fairness control remains actionable and neither strengthens nor weakens the English control.
