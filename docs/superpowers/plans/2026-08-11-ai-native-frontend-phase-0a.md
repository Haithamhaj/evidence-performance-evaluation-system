# AI-Native Frontend Phase 0A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the source-validated experience definition, governance boundaries, interactive
Today prototype, manual/operator wireflows, and evidence required for Product Owner Gate `D0`,
without adding production frontend or agent runtime code.

**Architecture:** Phase 0A is documentation and an isolated non-production prototype only. Engine
domains remain authoritative; a machine-readable frontend coverage record adds experience decisions
without copying backend truth. The prototype proves information hierarchy and interaction states but
cannot select production tokens, primitives, components, dependencies, or navigation before `D0`.

**Tech Stack:** Existing Node 24.18.0/pnpm 11.13.0 repository tooling, Markdown/JSON, Zod-free Node
validators, standalone HTML/CSS/JavaScript prototype, Playwright for bounded interaction evidence.

## Global Constraints

- Start from clean `main` at `2eee638958294b790c75375d564d5c03188062f2`; never merge
  `experimental/clickup-multi-agent-ui`.
- The master authority is `docs/superpowers/plans/2026-08-11-ai-native-frontend-master-plan.md`.
- Do not modify production code under `apps/web`, `apps/api`, `apps/worker`, or `packages/*` in Phase 0A.
- Do not add runtime dependencies, product tokens, primitive libraries, Storybook, agents, SSE, or
  production event contracts before `D0`.
- Preserve exactly 44 capability records: 39 `COMPLETE`, 2 `PARTIAL`, 2 `EXTERNAL_GATE`, and 1
  `DEFERRED_APPROVED`; no `PLANNED` record.
- Backend names, statuses, owners, public contracts, AI prohibitions, human gates, and external gates
  come only from `ENGINE_FEATURE_REGISTER.md`.
- Assistance Mode/Owner/Trigger are experience decisions and must not imply domain authority.
- Work Signals, Experience Workflow Events, and Product Telemetry remain distinct. Navigation and UI
  interaction never become Work Signals or protected facts.
- AI never selects, predicts, challenges, or recommends a rating. Project progress never derives from
  activity volume.
- Arabic evaluation remains T016-gated. Normal Arabic/RTL prototype states remain required.
- Use Fast Controlled Execution: focused validators, prototype interaction checks, one architecture
  feasibility review at D0, and no broad engine/security review loop.
- Stop at Gate `D0`; production foundation begins only after recorded Product Owner approval.

---

### Task 1: Preserve the approved master plan and baseline receipt

**Files:**

- Create: `docs/superpowers/plans/2026-08-11-ai-native-frontend-master-plan.md`
- Create: `docs/product/AI_NATIVE_FRONTEND_SOURCE_SNAPSHOT.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: approved pasted master plan; Git commit/blob identities; E7 completion artifacts.
- Produces: one durable authority path and one immutable source receipt for later validators.

- [ ] **Step 1: Verify the approved source and normalized repository copy**

Run:

```bash
shasum -a 256 \
  /Users/haitham/.codex/attachments/c4e4dc34-37d6-4eac-9ef6-3f6880e09af8/pasted-text.txt \
  docs/superpowers/plans/2026-08-11-ai-native-frontend-master-plan.md
```

Expected:

```text
approved attachment: c37e6b2ea3bd0c2d00b40af8e4fc9f5e984ee4bf52a60809d9d0e12ec958c920
Prettier-normalized repository copy: ef52f66cd2d7e9b74eab1a1a7d4f6ed0ddb80be369b942816074491cc1c0c669
```

The repository copy differs only through Markdown normalization; the attachment hash remains the
approval receipt.

- [ ] **Step 2: Write the source snapshot receipt**

Record:

```text
main: 2eee638958294b790c75375d564d5c03188062f2
engine baseline: a631eaa81a5b462f329e5917c5be3301281f970a
feature register blob: 0e462d5af380160b2fa0ad7c871c319dce2e08d4
capability matrix blob: aa04a6ac3f310eb195b3d13e7885897716574601
journey map blob: 39aed072a9c74135b2a28a1c962202ff3a0836bf
handoff schema blob: c3978600b1c9cfc88a3dc1b7682f5606e1718ca9
negative reference only: experimental/clickup-multi-agent-ui
```

- [ ] **Step 3: Update project state**

Set the current goal to Phase 0A and state explicitly that production shell/runtime work is blocked
until `D0` then `G0`.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm exec prettier --check \
  docs/product/AI_NATIVE_FRONTEND_SOURCE_SNAPSHOT.md \
  project-state/PROJECT_STATE.md
git diff --check
```

The approved attachment and normalized repository copy are each verified by SHA-256. Do not edit
product meaning while normalizing Markdown.

Commit: `docs: preserve AI-native frontend authority`

---

### Task 2: Create the source-backed frontend capability record

**Files:**

- Create: `docs/product/ai-native-frontend-capabilities.json`
- Create: `scripts/validate-ai-native-frontend-capabilities.mjs`
- Create: `tests/repository/ai-native-frontend-capabilities.test.ts`
- Modify: `package.json`
- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`

**Interfaces:**

- Consumes: 44 engine capability headings/statuses and Phase 0A delivery decisions from the master
  plan.
- Produces: `FrontendCapabilityRecordV1[]` plus command
  `pnpm validate:frontend-capabilities`.

- [ ] **Step 1: Write the failing repository test**

```ts
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("AI-native frontend capability coverage", () => {
  it("matches the authoritative 44 engine records", () => {
    expect(() =>
      execFileSync("node", ["scripts/validate-ai-native-frontend-capabilities.mjs"], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec vitest run --root . tests/repository/ai-native-frontend-capabilities.test.ts
```

Expected: FAIL because the JSON record and validator do not exist.

- [ ] **Step 3: Define `FrontendCapabilityRecordV1` as data**

Each of the 44 JSON rows must contain exactly:

```json
{
  "schemaVersion": 1,
  "capabilityId": "CAP-001",
  "officialName": "Sign-in and synchronized identity",
  "sourceStatus": "COMPLETE",
  "targetSurfaces": ["sign-in", "session-recovery", "profile"],
  "deliveryPhases": ["P1", "P8"],
  "assistanceModes": ["contextual_status_recovery"],
  "assistanceOwners": ["auth_session_domain"],
  "triggers": ["session_state_changed", "user_retry"],
  "manualOrOperatorPath": "sign-in and session recovery",
  "externalGate": "production OIDC client/realm configuration"
}
```

Allowed source states are `COMPLETE`, `PARTIAL`, `EXTERNAL_GATE`, and `DEFERRED_APPROVED`.
Allowed assistance modes are the six values approved in the master plan. Rows may contain multiple
modes because classification is refined per user moment later.

- [ ] **Step 4: Implement strict reconciliation**

The validator must:

```text
parse 44 CAP headings from ENGINE_FEATURE_REGISTER.md
normalize COMPLETE suffixes such as TECHNICAL CHECKPOINT
compare every ID, official name, and source state
require unique target surface, phase, mode, owner, trigger values
require an external gate for EXTERNAL_GATE rows
require no pilot surface/trigger for CAP-034
assert counts 39/2/2/1 and zero PLANNED
```

It must not compare experience fields back into the engine register.

- [ ] **Step 5: Correct the stale CAP-018 note**

Replace only the obsolete statement that the full leave engine is pending. Preserve CAP-018 status,
protected readiness behavior, and all other engine facts; cite completed CAP-037 as its continuity
dependency.

- [ ] **Step 6: Add the package command and run GREEN**

Add:

```json
"validate:frontend-capabilities": "node scripts/validate-ai-native-frontend-capabilities.mjs"
```

Run the focused test, existing engine register validator, and the new command. Expected: 44 valid
rows and exact status counts.

- [ ] **Step 7: Commit**

Commit: `docs: reconcile AI-native frontend capabilities`

---

### Task 3: Detail Phase 1–3 assistance handoffs

**Files:**

- Create: `docs/product/AI_NATIVE_PHASE_1_3_HANDOFFS.md`
- Modify: `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- Modify: `docs/product/ai-native-frontend-capabilities.json`
- Modify: `scripts/validate-ai-native-frontend-capabilities.mjs`

**Interfaces:**

- Consumes: CAP-001–027 coverage records and existing public reader/command descriptions.
- Produces: one handoff per important Phase 1–3 user moment/action with Assistance Mode, Owner,
  Trigger, authority, state, and recovery.

- [ ] **Step 1: Extend the handoff schema**

Add required fields:

```text
Assistance Mode
Assistance Owner
Trigger/Activation
Work Signal classification
Experience Workflow Event classification
Product Telemetry eligibility
Freshness requirement
Inspection projection
Manual fallback
```

- [ ] **Step 2: Write moment-level records**

Cover at minimum:

```text
session recovery
Today read/decision/prepared/change/status
universal capture
Task create/complete/dependency
connected context review
GitHub source suggestion
Project overview/contract/progress
Project ownership transfer
document/criteria review
Research source/question/experiment/decision/applied learning
```

Each action selects one or more justified modes. Do not assign an agent to deterministic
sorting/permissions/progress calculation/health/status work.

- [ ] **Step 3: Add validator assertions**

Require every P1–P3 record to name a manual/operator path, at least one mode, a mode-compatible
owner, a closed trigger or `none`, protected visibility, and recovery.

- [ ] **Step 4: Verify**

Run the frontend-capability validator and Prettier on the handoff files. Manually inspect CAP-012,
CAP-021–024, and CAP-027 for volume/performance/rating leakage.

- [ ] **Step 5: Commit**

Commit: `docs: define Phase 1 to 3 assistance handoffs`

---

### Task 4: Define event taxonomies and forbidden dependency directions

**Files:**

- Create: `docs/architecture/ADR-0001-experience-event-separation.md`
- Create: `docs/product/AI_NATIVE_EVENT_TAXONOMY.md`
- Create: `docs/product/ai-native-event-taxonomy.json`
- Create: `scripts/validate-ai-native-event-taxonomy.mjs`
- Create: `tests/repository/ai-native-event-taxonomy.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: the master plan event model and existing domain/connector/job concepts.
- Produces: closed Phase 0A taxonomies only; no production runtime types.

- [ ] **Step 1: Write RED taxonomy tests**

Assert that:

```ts
expect(workSignals).not.toContain("page.viewed");
expect(workSignals).not.toContain("drawer.opened");
expect(telemetryDestinations).not.toContain("experience_orchestrator");
expect(telemetryDestinations).not.toContain("protected_command");
expect(unknownWorkSignalPolicy).toBe("fail_closed");
```

- [ ] **Step 2: Define three closed registries**

The JSON must contain separate arrays for:

```text
workSignals: domain / connector / scheduled_work_check / user_domain_action
experienceWorkflowEvents: confirm / correct / dismiss / retry / submit / recovery
productTelemetryEligible: bounded view/preference/recovery/performance action keys only
```

Explicitly forbid hover, scroll, dwell, active time, search focus, raw navigation trail, content
bodies, ratings, readiness values, private source URLs, prompts, and outputs.

- [ ] **Step 3: Record the ADR**

The ADR must state that later production contracts are implemented just-in-time, telemetry has no
import path to orchestration/authority/progress/evaluation/manager/evidence facts, and unknown Work
Signals fail closed.

- [ ] **Step 4: Run GREEN and commit**

Add `validate:frontend-events`, run its test and validator, then commit:
`docs: define AI-native event separation`.

---

### Task 5: Establish Codex Skill discovery and lifecycle governance

**Files:**

- Create: `docs/engineering/CODEX_SKILL_GOVERNANCE.md`
- Create: `docs/engineering/CODEX_SKILL_REVIEW_TEMPLATE.md`

**Interfaces:**

- Consumes: master plan §16 and repository `AGENTS.md` authority.
- Produces: decision policy for one-time, workspace-shared, and project-owned Skills.

- [ ] **Step 1: Define discovery scope**

Document when routine work needs no search and when specialized/high-risk work must inspect installed,
workspace-shared, project-owned, or trusted catalog Skills.

- [ ] **Step 2: Define external Skill review**

Require source, license, maintenance, instructions/scripts, dependencies, file/command access,
stack compatibility, and overlap review before material use.

- [ ] **Step 3: Define promotion and retirement**

Project-owned promotion requires repeated use, measured value, tests, purpose/triggers/exclusions,
owner, semantic version, review cadence, and deprecation path. Overlapping or stale Skills must be
merged or retired.

- [ ] **Step 4: Define authority order**

State exactly:

```text
system/developer/user instruction
→ AGENTS.md and protected product rules
→ approved specs/ADRs/public contracts
→ CI and acceptance gates
→ Skill instructions
```

A Skill never changes architecture, dependencies, security, or protected behavior silently.

- [ ] **Step 5: Self-review and commit**

Search for `TBD|TODO|always install|fixed skill list`, run Prettier, then commit:
`docs: govern Codex skill discovery`.

---

### Task 6: Map personas, visibility, and initial autonomy

**Files:**

- Create: `docs/product/AI_NATIVE_PERSONA_VISIBILITY_MAP.md`
- Create: `docs/product/AI_NATIVE_INITIAL_AUTONOMY_MAP.md`
- Modify: `docs/product/AI_NATIVE_PHASE_1_3_HANDOFFS.md`

**Interfaces:**

- Consumes: protected field map, role policies, CAP-001–027 moments, and autonomy classes.
- Produces: positive/negative visibility matrix and action-level bounds for Phase 1–3.

- [ ] **Step 1: Map personas and denied fields**

Include employee, contributor, Project owner, Workstream owner, acting owner, manager, System
Administrator, operations, and deactivated user. Explicitly protect private connected context,
readiness values, employee self-rating independence, coaching privacy, and identified-feedback truth.

- [ ] **Step 2: Map action autonomy**

For every Phase 1–3 action, record the strictest applicable class from:

```text
observe | prepare | auto_maintenance | auto_with_undo | confirm | human_only
```

`auto_with_undo` remains disabled because Phase 0A selects no production action or compensation
command.

- [ ] **Step 3: Prove non-authority inputs**

Document and validate that AI confidence, acceptance rate, inferred trust, personalization, and
Product Telemetry cannot increase permissions or autonomy.

- [ ] **Step 4: Focused protected-rule review and commit**

One specification check only; fix confirmed P0/P1 contradictions, record lower-priority copy ideas
without blocking. Commit: `docs: map frontend visibility and autonomy`.

---

### Task 7: Produce the Experience Blueprint and D0 IA research protocol

**Files:**

- Create: `docs/product/AI_NATIVE_EXPERIENCE_BLUEPRINT.md`
- Create: `docs/product/AI_NATIVE_IA_D0_PROTOCOL.md`
- Create: `docs/product/wireflows/AI_NATIVE_MANUAL_OPERATOR_WIREFLOWS.md`

**Interfaces:**

- Consumes: customer journey map, Phase 1–3 handoffs, persona/visibility map, and master IA
  hypothesis.
- Produces: user-moment blueprint and test protocol; it does not produce final navigation.

- [ ] **Step 1: Define stable moments**

Blueprint Today, Work, Project, Research, Evaluation, Manager, and Admin around user intent, primary
action, must-see/on-demand/hidden information, manual fallback, smart state, source/why/freshness,
recovery, and deep link.

- [ ] **Step 2: Define Today states**

Cover normal, busy, clear, prepared, needs-decision, deterministic status, stale, recoverable error,
agent job, and What Changed. Internal P0/P1/P2 priority labels must not appear in product copy.

- [ ] **Step 3: Define manual/operator wireflows**

Use Mermaid state/flow diagrams for complete Work, Project, Research, fixed Evaluation, Manager, and
Admin/recovery paths. Chat is an alternate channel only.

- [ ] **Step 4: Define IA research questions and participants**

Test Research placement, Development/Insights visibility, Connections/Notifications placement,
desktop/mobile variation, frequent-path speed, and navigation density with representative technical
and less-technical internal users.

- [ ] **Step 5: Define success evidence**

Record task-completion path, wrong-destination count, backtracking, comprehension of AI states,
decision burden, manual fallback discovery, RTL/mobile issues, and qualitative confidence. Do not
collect employee activity/performance metrics.

- [ ] **Step 6: Product Owner blueprint review**

Present the blueprint section-by-section. Resolve product contradictions before visual ideation;
commit: `docs: define AI-native experience blueprint`.

---

### Task 8: Build the bounded Today prototype and visual options

**Files:**

- Create: `prototypes/ai-native-phase-0a/README.md`
- Create: `prototypes/ai-native-phase-0a/index.html`
- Create: `prototypes/ai-native-phase-0a/styles.css`
- Create: `prototypes/ai-native-phase-0a/prototype.js`
- Create: `prototypes/ai-native-phase-0a/fixtures.js`
- Create: `scripts/serve-ai-native-phase-0a-prototype.mjs`
- Create: `playwright.phase0a.config.ts`
- Create: `tests/e2e/ai-native-phase-0a-prototype.spec.ts`

**Interfaces:**

- Consumes: approved blueprint and IA protocol.
- Produces: one isolated, synthetic, non-production interactive prototype plus bounded evidence.

- [ ] **Step 1: Generate exactly three visual directions**

Use Product Design ideation after replaying the approved brief. Each direction must show the same
Today busy/decision/prepared/change content at desktop and 390px, without copying ClickUp/Notion
branding. Wait for Product Owner selection before coding the prototype.

- [ ] **Step 2: Implement only the selected direction**

The standalone prototype must have no import from production code and no new runtime dependency. It
must switch English/Arabic, desktop/mobile fixtures, role-visible areas, Today states, one decision
flow, one prepared-draft flow, one recovery flow, and one What Changed receipt.

- [ ] **Step 3: Implement accessible interaction**

Use native controls and landmarks; preserve focus on state changes, return focus from sheets, announce
job/recovery state, use logical CSS properties, honor `prefers-reduced-motion`, and keep mixed bidi
technical text readable.

- [ ] **Step 4: Write focused Playwright evidence**

Test keyboard-only decision and prepared flows, Arabic `dir=rtl`, 390px layout, focus return,
reduced-motion class behavior, clear state, stale/retry recovery, and absence of score/rating/priority
copy.

- [ ] **Step 5: Capture D0 screenshots**

Save normal/busy/clear/decision/prepared/recovery states for English desktop, Arabic desktop, and
Arabic 390px under `docs/product/screenshots/ai-native-phase-0a/`.

- [ ] **Step 6: Commit**

Commit: `prototype: demonstrate AI-native Today experience`.

---

### Task 9: Run D0 review and record the human gate

**Files:**

- Create: `docs/reviews/AI_NATIVE_FRONTEND_D0_EVIDENCE.md`
- Create: `docs/decisions/AI_NATIVE_FRONTEND_D0_DECISION.md`
- Modify: `docs/product/AI_NATIVE_EXPERIENCE_BLUEPRINT.md`
- Modify: `docs/product/AI_NATIVE_IA_D0_PROTOCOL.md`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `project-state/SYSTEM_MAP.html`

**Interfaces:**

- Consumes: all Phase 0A artifacts and representative-user observations.
- Produces: explicit `APPROVED`, `APPROVED_WITH_BOUNDED_CORRECTIONS`, or `NOT_APPROVED` D0 decision.

- [ ] **Step 1: Run representative internal reviews**

At minimum include Product Owner, one daily employee, one manager/Project owner, one less-technical
internal user, and one architecture feasibility reviewer. Use the same tasks and fixtures; record
observations without employee evaluation.

- [ ] **Step 2: Record evidence**

Document comprehension of Today zones, IA destinations, manual fallbacks, AI-state distinctions,
source/why/freshness, recovery, Evaluation stability, mobile/RTL/keyboard behavior, and unresolved
P0/P1 product or feasibility defects.

- [ ] **Step 3: Apply one bounded prototype correction cycle**

Correct confirmed D0 blockers only, rerun affected prototype checks, and do not start production
foundation work.

- [ ] **Step 4: Obtain Product Owner decision**

The Product Owner records one D0 state and approved IA/visual direction. Representative-user or
architecture observations inform the decision but do not replace it.

- [ ] **Step 5: Close Phase 0A or stop**

If approved, update Project State to authorize Phase 0B planning only. If not approved, list exact
blocking artifact and remain in Phase 0A. In both cases, do not add production tokens, primitives,
Storybook, Shell, runtime contracts, Orchestrator, SSE, or Agents in this plan.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm validate:frontend-capabilities
pnpm validate:frontend-events
pnpm exec vitest run --root . \
  tests/repository/ai-native-frontend-capabilities.test.ts \
  tests/repository/ai-native-event-taxonomy.test.ts
pnpm exec playwright test --config playwright.phase0a.config.ts
pnpm exec prettier --check \
  docs/product docs/architecture docs/engineering docs/reviews docs/decisions \
  prototypes/ai-native-phase-0a
git diff --check
```

Commit: `docs: record AI-native frontend D0 decision`

---

## Phase 0A Exit Boundary

This plan ends at D0. A positive D0 decision authorizes a separate Phase 0B implementation plan for
ADRs, exact Phase 1–2 engine handoffs, product tokens, primitive compatibility, Storybook/testing,
import boundaries, Stable Shell, inspection contract, route retirement, and Gate G0. It does not
authorize Phase 1 runtime or production Today implementation.
