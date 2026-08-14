# GPT-5.6 Cost–Quality Routing Policy

**Status:** Approved and active for locally registered routes  
**Policy version:** `gpt-5.6-cost-quality.v1`  
**Approved:** 2026-08-14

## Decision

The product uses all three available GPT-5.6 models through the existing AI Router. The frontend and the employee never choose a model. Each governed route is assigned a primary model and ordered fallbacks according to the task's cost, frequency, and consequence.

| Tier                   | Primary         | Ordered fallback | Intended work                                                                                             |
| ---------------------- | --------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| Frequent and bounded   | `gpt-5.6-luna`  | Terra, then Sol  | Project matching, short next-step preparation, and bounded Project questions                              |
| Daily assistance       | `gpt-5.6-terra` | Sol, then Luna   | Capture understanding, update structuring, task drafting, context summaries, and routine research framing |
| Complex or high-impact | `gpt-5.6-sol`   | Terra            | Progress-contract drafting, research synthesis, and experiment review or interpretation                   |

The exact route map lives in `scripts/gpt-5-6-routing-policy.ts`. Unknown or newly introduced routes are not assigned automatically. They require an explicit policy update and review.

## Guardrails

- Every model call remains behind the AI Router and its route trace.
- Every route change requires an authorized administrator, an audit reason, and a correlation ID.
- Prompt and output-schema versions are unchanged by this model-selection policy.
- The specialized `update.transcribe` audio route is not replaced by GPT-5.6.
- Provider credentials remain server-side and are never exposed to the browser, logs, repository, or routing output.
- Model fallback does not weaken authorization, privacy, employee confirmation, or any other human gate.
- No model may assign or recommend a performance rating, employee ranking, productivity score, or progress inferred from activity volume.
- Project progress continues to use approved measurable contract rules or authorized human confirmation only.

## Why this balance

Luna reduces cost for high-frequency, tightly bounded work. Terra is the default for rich daily employee interaction. Sol is reserved for tasks where deeper reasoning is worth the additional cost. This gives the employee one simple experience while the platform chooses the appropriate capability internally.

Official model and pricing references:

- [OpenAI model catalog](https://developers.openai.com/api/docs/models)
- [GPT-5.6 overview](https://openai.com/index/gpt-5-6/)
- [OpenAI API pricing](https://openai.com/api/pricing/)

## Operational use

Preview the safe plan:

```sh
pnpm ai:register:gpt-5-6-policy -- --dry-run
```

Live registration additionally requires the authorized administrator ID, system scope ID, correlation ID, and reason. The command registers or reuses all three provider configurations, then updates only existing governed routes. Future route-artifact registration can be followed by rerunning this policy command to activate the approved tier for those new routes.
