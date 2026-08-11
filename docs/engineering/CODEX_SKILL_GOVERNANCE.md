# Codex Skill Discovery and Lifecycle Governance

**Status:** Approved Phase 0A engineering policy  
**Applies to:** Codex and other repository agents using reusable instruction packages, scripts, or
tool workflows.

## Purpose

Skills should reduce repeated work without becoming hidden architecture or silent authority. This
policy distinguishes routine work, temporary specialist use, workspace-shared Skills, and
project-owned Skills.

## Authority Order

```text
system/developer/user instruction
→ AGENTS.md and protected product rules
→ approved specs/ADRs/public contracts
→ CI and acceptance gates
→ Skill instructions
```

A Skill cannot silently change architecture, dependencies, security, privacy, data ownership,
protected product behavior, approved acceptance criteria, or human gates. A conflict stops use of the
Skill until the higher authority is reconciled.

## Discovery Scope

Routine work does not require catalog search when existing repository instructions and tools fully
cover the task. Examples include a focused copy correction, a known formatter, or an existing
repository validator.

Inspect installed, workspace-shared, project-owned, or trusted-catalog Skills when work is:

- specialized enough that established procedures materially reduce error;
- high impact in authentication, privacy, audit, migration, historical immutability, AI boundaries,
  evaluation rules, deployment, or recovery;
- repeated across features with the same inputs, outputs, and verification;
- dependent on an artifact format or tool workflow the repository does not already define.

Use the smallest non-overlapping Skill set. Discovery is not authorization to install or execute an
external Skill.

## Scope Classes

| Class               | Use                                                                      | Persistence                                                                |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| One-time specialist | A bounded task with no demonstrated repetition                           | Use from trusted source after review; do not copy into the repository      |
| Workspace-shared    | Repeated across several repositories under common engineering governance | Maintained outside this product; pin/version according to workspace policy |
| Project-owned       | Repeated product-specific workflow whose value and boundaries are proven | Store with tests, owner, version, review cadence, and retirement path      |

## External Skill Review

Before material use, record:

1. Source repository/package and exact version or commit.
2. License and obligations for private/commercial use and redistribution.
3. Current maintenance and known security posture.
4. Complete instructions, referenced scripts/assets, and any network behavior.
5. Runtime/package dependencies and conflicts with the monorepo.
6. Files, commands, credentials, external systems, and destructive operations it may access.
7. Compatibility with the approved stack, repository boundaries, and current execution policy.
8. Overlap with existing Skills, scripts, CI checks, or product architecture.
9. Expected measurable value and the smallest safe trial.

Do not import AGPL, EPL, fair-code, enterprise, source-available, or incompatible material without
explicit approval. Never pass secrets or protected source content to a Skill unless its authority and
data handling are approved for that exact use.

## Project-Owned Promotion

Promotion requires all of the following:

- repeated use with the same problem and stable workflow;
- measured value such as reduced cycle time, fewer defects, or better acceptance evidence;
- a documented purpose, trigger, exclusions, owner, and semantic version;
- tests or deterministic verification for its outputs and dangerous boundaries;
- explicit allowed file/command/network scope;
- a review cadence and dependency-update policy;
- a deprecation and migration path.

Do not promote a Skill because it is fashionable, because it wraps one command, or because a single
task was difficult.

## Change, Review, and Retirement

- Patch changes clarify instructions without changing authority or outputs.
- Minor changes add backward-compatible capabilities with tests.
- Major changes alter triggers, outputs, permissions, dependencies, or authority assumptions and
  require explicit review.
- Review project-owned Skills at the documented cadence and after relevant architecture changes.
- Merge overlapping Skills when one bounded workflow can serve both without ambiguity.
- Retire stale or low-value Skills; remove their triggers and document the replacement or manual path.
- A retired Skill must not remain discoverable as active guidance.

## Execution Record

When a Skill materially changes work, the task record states which Skill was used, why it was
appropriate, what files/commands it influenced, and any new risk or limitation. The implementation
and acceptance evidence—not Skill invocation—prove completion.
