# PROJECT_REFERENCE.md

## Evidence-Based Performance Evaluation System

**Document type:** Approved Project Reference  
**Status:** Consolidated baseline for architecture, planning, implementation, and future AI-agent execution  
**Pilot organization:** LeapAI / AI Department  
**Initial deployment model:** Single-organization internal deployment with product-ready configurability  
**Primary source:** Original Master Product Definition, consolidated with all approved project decisions  
**Last updated:** 2026-07-13  
**Revision:** 1.1 — post-handoff review corrections

---

# 1. Purpose of This Document

This document is the authoritative approved reference for the project.

It consolidates the product concept, operating model, governance rules, workflow decisions, AI boundaries, evaluation structure, permissions, and future configurability into one coherent baseline.

It replaces the scattered decision trail used during discovery. Individual discussion notes, brainstorms, and earlier assumptions are not authoritative unless they are reflected here.

This document is not:

- A technical implementation plan.
- A database schema specification.
- A UI design.
- A deployment guide.
- A final evaluation rubric.
- A complete set of behavioral anchors.

Those artifacts will be derived from this reference.

---

# 2. Product Definition

The product is an internal performance evaluation and project documentation platform that connects:

1. Project definition and documentation.
2. Workstreams and employee contributions.
3. Continuous updates and evidence.
4. AI-assisted documentation readiness.
5. Quarterly or semiannual performance evaluation.
6. Employee self-assessment.
7. Manager assessment.
8. Comparison and discussion.
9. Manager-issued final evaluation.
10. Upward evaluation of the manager by employees.
11. Coaching insights and development actions.
12. Performance and development timelines over time.

The central principle is:

> Performance evaluation should be informed by real work, documented context, observed professional behavior, and actual contribution—not by memory, impression, raw activity volume, or last-minute recollection.

The system is evidence-supported, but not evidence-limited.

Evidence is strongest for practical work, research, experiments, implementation, outputs, and decisions. Professional behavior such as cooperation, responsibility, communication, and conduct may be evaluated through direct managerial observation even when no technical artifact exists.

---

# 3. Product Value

The system addresses the following recurring problems:

- Evaluations happen long after the work.
- Managers rely on memory and general impression.
- Employees remember only recent work.
- Research, learning, failed experiments, and technical exploration are poorly represented in task-management systems.
- Team contributions are difficult to separate fairly.
- Git activity is often mistaken for productivity.
- Long product work is unfairly compared with short POCs.
- Different departments need different criteria.
- Employees and managers may interpret the same rating differently.
- Upward manager evaluation is often missing or unsafe.
- Development plans are disconnected from actual work.
- Historical progress across cycles is difficult to reconstruct.

The product creates a continuous, reviewable, versioned record that supports fairer periodic evaluation without converting daily work into continuous automated scoring.

---

# 4. Initial Pilot Context

## 4.1 Pilot Scope

The first deployment is for the LeapAI AI Department only.

The pilot will be used by:

- The department manager.
- The department employees.
- A separate system administrator.

## 4.2 Team Model

The pilot team is flat.

There are no supervisors or permanent technical leads responsible for evaluating others.

Employees operate at the same general expectation level for the pilot, even though they may currently own different projects or work areas.

Examples of current work contexts include:

- Voicebot and machine-learning development.
- Large enterprise projects such as STC and Jawwy.
- Conversation analytics and quality-system product development.
- Client POCs.
- Research, experimentation, integration, and product improvement.

These work contexts are not fixed job silos. Employees may collaborate, transfer between areas, and use AI coding agents to work across frontend, backend, research, architecture, testing, and documentation.

## 4.3 Product-Ready Direction

Although the pilot is internal, the platform must be designed for rapid adaptation to:

- Other departments.
- Other companies.
- Different organizational hierarchies.
- Different evaluation templates.
- Different rating scales.
- Different document templates.
- Different AI models.
- Different privacy and approval policies.

The first version does not need commercial SaaS functions such as billing, subscription management, tenant self-service onboarding, or a template marketplace.

---

# 5. Core Principles

## 5.1 Human Final Judgment

AI supports evidence preparation, analysis, comparison, coaching, and documentation.

AI does not:

- Assign performance ratings.
- Recommend a rating from 1 to 5.
- Decide whether an employee is good or weak.
- Approve a final evaluation.
- Resolve contribution disputes as fact.
- Convert documentation quality into performance quality.
- Rank employees.

The manager makes the final employee evaluation decision.

## 5.2 Documentation Score Is Not Performance Score

The system maintains separate concepts:

1. Documentation Readiness or Update Completeness.
2. Self-Assessment Rating.
3. Manager Assessment Rating.
4. Final Performance Rating.
5. Upward Manager Evaluation Rating.

These must never be merged into one score.

## 5.3 Work Context Matters

Employees use the same fixed evaluation framework in the pilot, but their projects may differ greatly in:

- Duration.
- Complexity.
- Uncertainty.
- Client dependency.
- Research intensity.
- Number of contributors.
- Speed of visible output.

The system must not compare employees by raw project count, update count, commit count, or delivery frequency.

## 5.4 Versioned Expectations

Project and workstream criteria must exist before they are used for evaluation.

If scope changes, criteria may change prospectively through versioning.

New criteria must not be applied retroactively.

## 5.5 Configuration Over Hardcoding

The following must be configurable rather than embedded in code:

- Evaluation templates.
- Criteria.
- Sections.
- Weights.
- Rating anchors.
- Project document templates.
- Workstream document templates.
- Review cadence.
- Privacy policies.
- AI model routing.
- Organizational roles and workflows.
- Retention policies.
- Approval rules.

## 5.6 Auditability

Important actions must remain traceable, including:

- Template changes.
- Criteria changes.
- Rating changes.
- Evidence changes.
- Document versions.
- Delegations.
- Sensitive-data access.
- AI-model overrides.
- Evaluation closure.
- Project ownership changes.

---

# 6. Scope

## 6.1 Included in the Core Product

- Project tracking.
- Workstream tracking.
- Project and workstream documents.
- Text, voice, file, link, and image updates.
- Evidence collection and verification.
- GitHub document synchronization.
- GitHub PR, commit, and test-result suggestions.
- Documentation readiness analysis.
- Dynamic project criteria.
- Dynamic workstream criteria.
- Fixed organizational and department criteria.
- Self-assessment.
- Manager assessment.
- Comparison and discussion.
- Manager-issued final evaluation.
- Manager upward evaluation.
- Coaching insights.
- Personal and formal development actions.
- Leave, delegation, handover, and return handover.
- Employee and project timelines.
- Roles, permissions, privacy, versioning, and audit logs.
- Configurable AI model routing.
- Reports and dashboards.

## 6.2 Explicitly Out of Scope

- Payroll.
- Salary decisions.
- Bonus calculations.
- Automatic promotion or termination decisions.
- Automated disciplinary action.
- Time tracking as a performance measure.
- Automatic employee ranking.
- Commit count as performance.
- Daily performance scoring.
- AI-generated performance ratings.
- Full HR leave management or leave-balance calculation.
- Commercial billing and subscription management in the pilot.
- Formal multi-level appeal workflow in the pilot.
- Google Drive automatic synchronization in the first implementation.

---

# 7. Core Operating Model

The operating hierarchy is:

```text
Organization
└── Department
    ├── Users
    ├── Evaluation Templates
    ├── Projects
    │   ├── Project Master Document
    │   ├── Project-Level Dynamic Criteria
    │   ├── Project Timeline
    │   ├── Evidence Repository
    │   └── Workstreams
    │       ├── Workstream Document
    │       ├── Workstream-Level Dynamic Criteria
    │       ├── Workstream Timeline
    │       ├── Evidence
    │       └── Members and Responsibility Windows
    └── Evaluation Cycles
```

---

# 8. Projects and Workstreams

## 8.1 Project

A Project is the top-level unit of organized work.

Each project contains:

- One Project Master Document.
- One Primary Project Owner.
- Zero or more Project Members / Co-Contributors.
- One shared project timeline.
- One shared evidence repository.
- One to three project-level dynamic criteria.
- Zero or more Workstreams.

## 8.2 Primary Project Owner

Every active project has one Primary Project Owner.

The role exists for coordination only.

Responsibilities include:

- Maintaining the general project state.
- Ensuring the Project Master Document is current.
- Completing the project-level weekly check-in.
- Monitoring cross-workstream dependencies.
- Maintaining overall project continuity.

The Primary Project Owner:

- Is not a supervisor.
- Does not evaluate contributors.
- Does not automatically receive credit for team contributions.
- Does not gain managerial authority over project members.

## 8.3 Project Members / Co-Contributors

Projects may include multiple employees working simultaneously.

Each member records:

- Individual updates.
- Individual or shared evidence.
- Personal contribution.
- Team contribution.
- Decisions or activities they participated in.

Membership may begin and end at different dates.

## 8.4 Workstream

A Workstream is a defined component or scope of work within a project.

Examples:

- Frontend.
- Backend.
- Analysis Engine.
- Quality Framework.
- Model Evaluation.
- Voice Integration.
- Data Pipeline.
- Dashboard.
- Testing.
- Deployment.

A Workstream contains:

- One Workstream Document.
- One Primary Workstream Owner.
- Zero or more Contributors.
- Two to three dynamic criteria.
- Its own updates, evidence, and check-in status.
- Its own responsibility history.

A Workstream document belongs to the Workstream, not to an employee.

This allows responsibility to move between employees without recreating the knowledge base.

## 8.5 Primary Workstream Owner

Each active Workstream has one Primary Workstream Owner.

Responsibilities include:

- Maintaining the Workstream Document.
- Ensuring the workstream status is current.
- Completing or ensuring the weekly workstream check-in.
- Coordinating handover when needed.
- Reviewing AI-proposed workstream criteria.

The role is not managerial or evaluative.

## 8.6 Contributors

A Workstream may have multiple Contributors.

Each contributor records their own:

- Updates.
- Evidence.
- Contribution.
- Participation in decisions.
- Responsibility periods.

The system builds an Employee Contribution View automatically from these records.

No separate personal project document is required for each employee.

---

# 9. Project Master Document

## 9.1 Role

The Project Master Document is the authoritative reference for understanding the project.

It is not the place to store every daily event.

Daily research, experimentation, implementation, and decisions belong in the Activity Timeline and Evidence Repository unless they change the project fundamentally.

## 9.2 Protected Core Requirements

Every project document template must include six protected requirements that cannot be removed:

1. Project Definition and Ownership.
2. Problem and Context.
3. Objective and Expected Outcome.
4. Scope and Boundaries.
5. Expected Deliverables.
6. Definition of Success.

## 9.3 Configurable Default Requirements

The following are included in the default template but may be mandatory or optional depending on department or project type:

7. Proposed Approach.
8. Risks, Dependencies, and Open Questions.
9. References and Project Sources.

## 9.4 Conditional Sections

Additional sections may be required based on project type, such as:

- Data Strategy.
- Security and Privacy.
- Model Evaluation Plan.
- Test Plan.
- Deployment Plan.
- Integration Map.
- User Journey.
- Rollback Plan.
- Cost Estimate.
- Responsible AI.
- Client Acceptance Criteria.

## 9.5 Template Governance

System Administrators can manage organization-level templates.

Managers can manage department templates within their scope.

Templates are versioned.

Existing projects retain the template version they started with unless a formal migration is performed.

## 9.6 Readiness Validation

AI validates the document against its assigned template.

Possible readiness states:

- Draft.
- Incomplete.
- Ready for Criteria Generation.
- Criteria Approved.
- Revision Required.
- Superseded.

If required information is missing:

- AI identifies the missing item.
- AI explains why it matters.
- AI generates instructions that the employee can give to the coding or document agent they use.
- The employee updates the original document.
- The document is resynchronized or reuploaded.
- AI reanalyzes it.

The system must not create a competing internal source of truth by storing missing answers only inside the platform.

## 9.7 Project and Workstream Progress Contract

The approved Project Master Document remains the source of truth for project intent, scope, deliverables, and success conditions.

Each active Project, and each Workstream when separately measurable, has a versioned Progress Contract derived from the approved document. The contract is owned by the Projects domain and contains:

- Milestones.
- Deliverables.
- Operational KPIs.
- KPI baseline, target, unit, and direction.
- Acceptance conditions.
- Required evidence.
- Optional approved weights.
- Owner and approver.
- Effective date and version.
- The measurable rule used to calculate progress.

AI may propose a draft contract from the source document, but an authorized human must review and approve it before it becomes effective.

Official progress is calculated only from the approved measurable rules and confirmed source-supported values in the active contract. It must never be inferred from:

- Number or percentage of completed Work Items.
- Task volume.
- Update frequency.
- GitHub activity.
- Commit count.
- File count.
- Lines changed.

A Work Item, update, or evidence item may support a contract milestone or KPI, propose a value change, or signal that the source document may need revision. It does not change the contract by itself.

When an approved rule contains a qualitative condition that cannot be confirmed automatically, an authorized human may confirm whether that contract-defined condition has been met. The system then recalculates progress from the approved rule. A user cannot directly enter or override the overall progress percentage.

If the available information is insufficient, the prior official progress remains unchanged and the system identifies the missing confirmation or evidence. Progress may decrease when an approved measurable value decreases or a previously satisfied condition is no longer satisfied; the explanation and resulting snapshot are preserved in append-only history.

Any material change to milestones, KPIs, acceptance conditions, weights, or calculation rules requires:

1. A new material version of the Project or Workstream Document.
2. An impact explanation.
3. Authorized owner approval.
4. A new prospective Progress Contract version and effective date.

Previous progress snapshots remain linked to the contract version that produced them. Project progress is an operational status of the Project or Workstream. It is not employee performance, a productivity score, or a rating recommendation.

---

# 10. Workstream Document

Each Workstream has one shared document.

The Workstream Document includes at minimum:

- Workstream purpose.
- Scope.
- Expected output.
- Relationship to the parent project.
- Dependencies.
- Proposed approach or architecture.
- Definition of success.
- Responsible members.
- Relevant sources and repositories.

The same document is used even when multiple employees work on the Workstream.

Individual contributions are recorded separately in the Workstream Timeline and Evidence records.

---

# 11. Document Versioning

## 11.1 Project Document Changes

AI compares document versions and classifies changes as:

- Editorial.
- Routine execution update.
- Material scope or goal change.

A material change includes changes to:

- Goal.
- Scope.
- Expected output.
- Architecture.
- Success definition.
- Core assumptions.
- Project-level criteria.

When a material change occurs:

- AI explains the impact.
- AI may propose updated criteria.
- The prior document and criteria remain preserved.
- The new criteria apply only from their effective date.
- Previous work is evaluated under the criteria active when it was performed.

## 11.2 Workstream Document Changes

The same versioning principle applies to Workstreams.

Each criteria version is linked to:

- Workstream document version.
- Effective date.
- Change reason.
- Acknowledgments.
- Objections.
- Previous version.

---

# 12. Dynamic Criteria

## 12.1 Project-Level Criteria

Each project has one to three general dynamic criteria.

They measure project-level outcomes such as:

- Overall result.
- Integration across components.
- Readiness for use or next stage.
- Achievement of a critical project objective.

## 12.2 Workstream-Level Criteria

Each Workstream has two to three specialized dynamic criteria.

They are derived from the Workstream Document and measure the success of that component.

Examples:

- Accuracy of analysis.
- Reliability of integration.
- Quality of evaluation methodology.
- Correct representation in the frontend.
- Reusability of architecture.

## 12.3 AI Generation

AI proposes each criterion with:

- Name.
- Reason for selection.
- Link to project or workstream success.
- Expected behavior or result.
- Evaluation method.
- Suggested evidence.

AI does not assign a numeric score.

## 12.4 Employee Review

For a single-owner project, the employee reviews and approves the proposed criteria.

The employee may:

- Correct AI’s understanding.
- Reject a criterion with a reason.
- Request an alternative.
- Improve wording.

The employee may not directly weaken the substance or measurement method.

## 12.5 Workstream Multi-Contributor Review

For Workstreams:

1. AI proposes two to three criteria.
2. Primary Workstream Owner reviews them.
3. Final proposed criteria are shown to all Contributors.
4. Each Contributor acknowledges understanding.
5. A Contributor may object with a reason.
6. Full consensus is not required.
7. Material objections remain recorded.
8. The team may revise the Workstream Document or request new criteria.
9. The manager may resolve the operating decision if needed but does not invent technical criteria independently.

## 12.6 Effective Dates

Criteria are versioned and date-bound.

Past contributions remain associated with the criteria version active at the time.

No retroactive application is permitted.

---

# 13. Activity Timeline

The Activity Timeline stores actual events and must not overwrite history.

Supported event types include:

- Research.
- Learning.
- Experiment.
- Implementation.
- Decision.
- Problem.
- Resolution.
- Documentation.
- Collaboration.
- Delivery.
- Scope Change.
- Blocker.
- Priority Change.
- Handover.
- Delegation.
- No-Change Confirmation.

Each event may include:

- Employee.
- Project.
- Workstream.
- Date and period.
- Original text or voice input.
- AI-structured summary.
- Claim.
- Contribution.
- Participants.
- Result.
- Impact.
- Learning.
- Decision.
- Next step.
- Related criteria.
- Evidence.
- Verification state.

---

# 14. Updates and Weekly Check-ins

## 14.1 Event Updates

Employees may add updates whenever meaningful work occurs.

There is no artificial daily limit.

An employee may submit multiple updates per day.

The update lifecycle is:

1. The employee provides raw text or voice.
2. AI detects missing context and asks one visible question at a time, continuing for as many questions as are needed.
3. The employee attaches evidence or reviews suggested evidence in the same flow.
4. The system compares the update with the previous relevant state.
5. AI structures the update and identifies any proposed milestone, KPI, criterion, or evidence relationship.
6. The employee edits the structured draft.
7. The employee explicitly confirms it.
8. The system appends the confirmed timeline event without overwriting prior events.

The prototype may use deterministic simulated AI. Production AI uses the AI Router only. AI output remains a draft until the employee confirms it.

Each evidence item identifies:

- The supported claim.
- The Project.
- The related Work Item when the evidence supports one.
- The Workstream when applicable.
- The related operational KPI or dynamic criterion when applicable.
- Contribution context.
- Verification state.

AI may draft an evidence description, but employee review and confirmation are mandatory. On mobile, opening evidence for review must show a visible drawer or bottom sheet rather than placing the form below the evidence list.

## 14.2 Thursday Check-in

Every active Workstream has a weekly check-in deadline on Thursday.

If a meaningful update was submitted during the week, no additional check-in is required.

If no update exists, the Primary Workstream Owner provides a quick status confirmation.

Possible status options include:

- Work continues with no material change.
- Temporarily paused.
- Priority moved to another project.
- Waiting for data, access, decision, or external party.
- Work is in progress but has not produced a result.
- Completed but not yet closed.
- No longer active.
- A substantive update will be added now.

## 14.3 Project-Level Check-in

The system aggregates Workstream statuses.

The Primary Project Owner then confirms only:

- Overall project state.
- Cross-workstream dependencies.
- Shared risks.
- Timeline or scope change.
- Integration concerns.

The Primary Project Owner does not rewrite Workstream details.

## 14.4 Missing Updates

A missing weekly update is recorded operationally.

It does not automatically reduce performance evaluation.

Repeated missing updates may become relevant only if the official evaluation framework includes a human-assessed criterion such as responsibility or documentation discipline.

---

## 14.5 Monthly Evaluation Readiness Review

Once per month, the system provides an evidence-readiness review to each employee.

It highlights:

- Active Projects or Workstreams with no substantive update during the month.
- Artifact-based criteria with no supporting source yet.
- Claims without a result, decision, or conclusion.
- Experiments without baseline, measure, or recorded conclusion.
- Learning records without demonstrated application.
- Unreviewed GitHub Suggested Evidence.
- Contribution records with unresolved attribution.

The review must not require an arbitrary number of updates or evidence items.

Its message is:

> The current record may not be sufficient to represent this part of your work during evaluation.

It is a readiness aid, not a score and not an automatic performance penalty.

Managers may see team-level readiness states and project/workstream gaps, but not an employee readiness percentage or ranking.

---

# 15. Evidence and Artifacts

## 15.1 Supported Evidence

The system supports:

- Files.
- Links.
- GitHub repositories.
- Pull Requests.
- Commits.
- Test results.
- CI/CD results.
- Images and screenshots.
- Code screenshots.
- Dashboard screenshots.
- Logs.
- Error messages.
- Architecture diagrams.
- Workflow diagrams.
- Benchmark results.
- Research papers.
- Training links.
- Video or course references.
- Datasets.
- Client documents.
- POC outputs.

## 15.2 Visual Evidence

Images may support an update but require context:

- What the image shows.
- Which claim it supports.
- Source.
- Related project or Workstream.
- Time.
- Result or conclusion.

An image without context is not considered fully verified evidence.

## 15.3 Verification States

Evidence may be classified as:

- Verified.
- Partially Verified.
- Self-Reported.
- Additional Evidence Needed.
- Team Contribution.
- Unable to Verify.
- Conflicting Evidence.
- Source-Supported.
- Peer-Acknowledged.
- Attribution Disputed.
- Attribution Clarified.
- Unable to Attribute.

## 15.4 Documentation Readiness

Documentation Readiness measures whether an update is complete enough to understand and review.

It may consider:

- Clear activity.
- Clear employee role.
- Correct project or Workstream.
- Appropriate evidence.
- Result.
- Participants.
- Next step.
- Learning or decision when relevant.
- Claim-to-source match.

The score remains separate from performance evaluation.

### Employee View

The employee may see:

- Detailed percentage or dimensions.
- Missing elements.
- Trend over time.
- Suggested corrective actions.

### Manager View in the Pilot

The manager may see operational states only:

- `Ready`.
- `Needs Attention`.
- `Missing Critical Information`.

The manager does not see:

- Individual readiness percentage.
- Employee ranking by readiness.
- Comparative readiness trends between employees.
- Readiness inside the rating selection screen.

`EED-04 Documentation and Reproducibility` is assessed through the full-period human rubric and must not copy or calculate from Documentation Readiness.

---

# 16. GitHub Integration

## 16.1 Initial Capabilities

The first implementation supports:

- Project document synchronization from GitHub.
- Repository, branch, path, and commit tracking.
- Pull Request discovery.
- Commit discovery.
- Test and CI result discovery where available.
- Suggested evidence inbox.

## 16.2 Suggested Evidence Only

GitHub activity is not automatically converted into:

- An approved update.
- An evidence record.
- An employee contribution.
- A performance rating.

The employee selects relevant items and adds context.

## 16.3 Evidence Inbox

The employee can:

- Accept and link an item.
- Merge it with other evidence.
- Mark it as a team contribution.
- Describe a partial contribution.
- Move it to another project.
- Reject or ignore it.
- Identify it as AI-assisted or agent-generated work.

## 16.4 AI-Assisted Development

The system recognizes execution modes such as:

- Manual.
- AI-Assisted.
- Agent-Generated.
- Mixed.

Execution mode does not automatically increase or reduce performance.

The evaluation should focus on:

- Problem understanding.
- Direction selection.
- Agent guidance.
- Review.
- Error detection.
- Testing.
- Validation.
- Responsibility for the result.

## 16.5 Prohibited GitHub Metrics

The system must not treat the following as performance on their own:

- Commit count.
- Lines changed.
- Pull Request size.
- File count.
- Frequency of activity.

---

# 17. Contribution Attribution

## 17.1 Employee Declaration

Each employee describes their own contribution.

For shared work, the record is visible to related participants.

Participants may:

- Add their own contribution.
- Correct role descriptions.
- Object to attribution.
- Provide supporting evidence.

## 17.2 No Implied Agreement

No response from another participant is not considered approval.

The record remains Self-Reported unless supported by sources or acknowledged by peers.

## 17.3 Disputes

If attribution is disputed:

- The original statement remains.
- The objection remains.
- Both sides’ evidence remains.
- AI summarizes agreement and disagreement.
- AI does not decide ownership of credit.
- The record remains `Attribution Disputed` until participants agree on a correction.

The manager may consider the dispute during evaluation but does not convert the historical record into “resolved” unless the contributors agree.

A disputed record may still support a team contribution if the underlying work itself is verified.

---

# 18. Fixed Evaluation Framework

The pilot employee evaluation uses four sections:

1. Professional Performance and Workplace Behavior.
2. AI Research, Learning, and Development.
3. Engineering, Execution, and Documentation.
4. Project Contribution.

## 18.1 Section 1: Professional Performance and Workplace Behavior

Initial criteria:

1. Responsibility and Reliability.
2. Collaboration and Knowledge Sharing.
3. Communication and Professional Conduct.
4. Initiative and Adaptability.

## 18.2 Section 2: AI Research, Learning, and Development

Initial criteria:

5. Problem and Hypothesis Formulation.
6. Research Quality and Technical Exploration.
7. Experiment and Evaluation Design.
8. Insight, Decision-Making, and Applied Learning.

## 18.3 Section 3: Engineering, Execution, and Documentation

Initial criteria:

9. Solution Design and Technical Judgment.
10. Execution Quality and Oversight of Agent Outputs.
11. Testing, Reliability, and Integration.
12. Documentation and Reproducibility.

## 18.4 Section 4: Project Contribution

This section does not use one fixed criterion list.

It draws from:

- Project-level criteria.
- Workstream-level criteria.
- Employee responsibility periods.
- Individual and team contributions.
- Evidence.
- Results.
- Decisions.
- Context and complexity.

The employee gives one self-rating for the section.

The manager gives one final rating for the section.

No automatic average is calculated across projects, Workstreams, or dynamic criteria.

---

# 19. Criteria Overlap Rules

The following boundaries are approved:

- Initiative is professional ownership and movement without detailed instruction.
- Problem solving is not a separate fixed criterion; it appears within research framing and technical judgment.
- Learning is not measured by consumption alone.
- Applied learning is measured through insight, decision, experiment, improvement, or knowledge transfer.
- Research measures reduction of uncertainty and decision formation.
- Engineering measures conversion of decisions into working, testable, maintainable solutions.
- Project contribution measures achievement within the specific project and Workstream context.
- Documentation Readiness is not the same as the documentation performance criterion.

The initial 12 criteria remain editable and versioned.

They are not yet final until their names, definitions, examples, anchors, and weights are approved.

---

# 20. Rating Scale

The pilot uses a 1-to-5 scale:

| Rating | Meaning                                                   |
| -----: | --------------------------------------------------------- |
|      1 | Significantly below expectations                          |
|      2 | Below expectations in important areas                     |
|      3 | Consistently meets expectations                           |
|      4 | Consistently exceeds expectations                         |
|      5 | Exceptional, sustained, and clearly impactful performance |

## 20.1 Behavioral Anchors

Each fixed criterion will have a short, specific anchor for every rating from 1 to 5.

Anchors must:

- Describe observable patterns.
- Represent the full evaluation period.
- Avoid judgment based on one incident.
- Avoid vague labels.
- Use the same meaning for employee and manager.
- Keep examples separate from the anchor.
- Avoid unrealistic perfection at rating 5.

The final set will contain 60 anchors for the 12 initial criteria.

This anchor set remains an open artifact to be created.

---

# 21. Weight Architecture

## 21.1 Section Weights

The four evaluation sections have weights whose total equals 100%.

## 21.2 Fixed-Criterion Weights

Criteria inside the first three sections have internal weights whose total equals 100% of their section.

## 21.3 Project Section

The Project Contribution section has one fixed section weight.

No numeric weighting or automatic averaging is applied between:

- Projects.
- Workstreams.
- Project criteria.
- Workstream criteria.

The dynamic criteria provide structured judgment inputs, not a hidden scoring formula.

## 21.4 Mandatory Global Criteria

The Organization Template may define criteria as `Mandatory Global Criteria`.

Managers cannot delete or disable them.

The System Administrator may define a minimum and maximum weight range.

The manager chooses a weight within the allowed range.

A template cannot be activated unless all weight rules pass and the total equals 100%.

---

# 22. Evaluation Templates and Governance

## 22.1 Organization Template

Managed by the System Administrator.

May include:

- General sections.
- Mandatory global criteria.
- Weight ranges.
- Rating scale.
- Protected definitions.
- Organization policies.

## 22.2 Department Template

Managed by the department manager.

The manager may:

- Add department criteria.
- Modify allowed definitions and wording.
- Merge or remove non-protected criteria.
- Set weights within allowed ranges.
- Add examples and anchors.
- Activate a new version for a future cycle.

The manager cannot:

- Delete protected global criteria.
- Change active-cycle criteria.
- Modify historical evaluations.
- Change other departments’ templates.

## 22.3 Cycle Snapshot

At evaluation-cycle launch, the complete template is frozen.

The cycle stores:

- Sections.
- Criteria.
- Weights.
- Rating anchors.
- Evidence guidance.
- Role expectations.
- Template version.

No active-cycle mutation is allowed without a formal revision mechanism, which is not part of the pilot.

---

# 23. Employee Evaluation Cycle

## 23.1 Cadence

Year 1:

- One employee evaluation every three months.
- Four cycles.

After stabilization:

- Default may move to every six months.

Cadence remains configurable.

## 23.2 First-Cycle Calibration

The first completed cycle is a formal `Calibration — Non-Baseline` cycle.

It runs the complete workflow, including self-assessment, manager assessment, comparison, discussion, final rating, and acknowledgment.

However:

- It is preserved historically as a calibration cycle.
- It is not used as the official longitudinal performance baseline.
- It is not used for financial, promotion, disciplinary, or employment decisions.
- Its purpose is to test criterion interpretation, evidence quality, workload, UI, and AI assistance.
- The first official performance baseline begins from Cycle 2 unless the manager explicitly approves a different future policy.

## 23.3 Stages

1. Cycle creation and eligibility snapshot.
2. Evidence preparation.
3. Employee self-assessment.
4. Independent manager assessment.
5. Comparison.
6. Discussion.
7. Manager final rating.
8. Employee acknowledgment or reservation.
9. Cycle closure.
10. Development plan.

## 23.4 Independent Assessment

The manager completes an initial assessment independently.

The manager should not see the employee’s self-rating until submitting the manager’s initial draft, to reduce rating anchoring.

## 23.5 Evaluation Fact View

Before the employee’s narrative justification is emphasized, the manager receives a normalized `Evaluation Fact View` containing:

- Event or result.
- Date and evaluation period.
- Project and Workstream.
- Actual responsibility window.
- Employee claim.
- Source-supported facts.
- Unsupported or unclear parts.
- Result or decision.
- Verification state.
- Attribution state.

The employee’s narrative remains available as `Employee Interpretation`.

AI may normalize all employee summaries into the same structure and tone, while preserving the original text for review.

The Fact View reduces, but cannot fully eliminate, differences in self-presentation ability.

## 23.6 Comparison

The system identifies:

- Rating gaps.
- High-weight criteria gaps.
- Missing justifications.
- Different evidence.
- Different contribution interpretations.
- Different understanding of duration or consistency.
- Disputed attribution records.

AI prepares the discussion agenda but does not resolve the difference.

## 23.7 Final Rating

The final rating is not:

- A mathematical average.
- A negotiated compromise.
- An AI decision.

The manager decides the final rating after review and discussion.

## 23.8 Employee Acknowledgment

The employee may:

- Acknowledge.
- Acknowledge with reservation.
- Not respond.

A reservation is preserved but does not block closure.

The pilot has no formal second-level appeal workflow.

Future deployments may enable HR or higher-manager review.

# 24. Upward Manager Evaluation

## 24.1 Separate Evaluation Model

The manager is evaluated using leadership and management criteria, not the employee technical criteria.

The approved pilot criteria are defined in `EVALUATION_RUBRIC.md`.

## 24.2 Cadence

Year 1:

- Every three months, synchronized with employee evaluation.

After stabilization:

- May move to every six months.

## 24.3 Pilot Visibility Mode — Identified

For the LeapAI AI Department pilot, upward manager evaluation is **identified and transparent**.

The manager can see:

- Which eligible employee submitted.
- Which eligible employee has not submitted.
- Each employee’s criterion ratings.
- Each employee’s written comments.
- Submission status and timestamp.
- Aggregated summaries and trends when available.

The pilot does not promise anonymity, manager-blinding, or suppression of individual responses.

This is an explicit operating choice by the department manager and must be communicated clearly to employees before the cycle opens.

## 24.4 Completion and Leave

The manager can view completion status by employee.

Results do not require a full-team anonymity publication gate in the pilot.

If an employee is on approved leave:

- Their status is shown as on approved leave.
- Their evaluation may remain pending until return or may be excluded from that cycle by the manager before the cycle closes.
- Other employees’ submitted evaluations remain visible and are not blocked.

## 24.5 Future Product Privacy Modes

The product architecture must support configurable modes for future organizations:

1. `Identified` — identity, ratings, and comments visible to the manager.
2. `Manager-Blinded` — identity hidden from the manager while original records remain available to an authorized independent role.
3. `Anonymous Aggregated` — only safe aggregates and repeated themes visible to the manager.

Each organization or department chooses one mode before a cycle opens.

The mode is frozen in the cycle snapshot and cannot change during the active cycle.

## 24.6 System Administrator Role

The System Administrator remains a separate technical role.

In the identified pilot, no special investigation-access workflow is needed merely to reveal the author because the manager already sees identified responses.

Future privacy modes may require:

- Identity separation.
- Restricted original-comment access.
- Independent HR or governance oversight.
- Multi-party approval.
- Sensitive-access audit.

Those controls remain configurable product capabilities, not pilot blockers.

## 24.7 AI Summaries

AI may provide:

- Aggregated trends.
- Repeated strengths.
- Repeated improvement themes.
- Comparison with previous cycles.

AI summaries do not replace or hide the identified responses in the pilot and do not assign a manager performance judgment automatically.

# 25. Coaching Insights

## 25.1 Continuous Development View

Coaching Insights appear throughout the quarter.

They are not ratings.

Employees see:

- Personal development trends.
- Research and experimentation patterns.
- Documentation gaps.
- Progress in project criteria.
- Repeated blockers.
- Development-plan progress.
- Comparison with their own past performance.

Managers see:

- Individual coaching trends.
- Team-wide patterns.
- Shared blockers.
- Training needs.
- Projects with repeated activity but weak conclusions.
- Documentation and experiment-quality trends.

## 25.2 Prohibited Analytics

The system does not produce:

- Predicted final rating.
- Continuous performance score.
- Employee ranking.
- Productivity score from commits.
- Relative comparison based on activity volume.
- Automatic negative judgment from leave or low visible activity.

## 25.3 Insight Transparency

Each insight should show:

- Observed pattern.
- Data used.
- Time range.
- Confidence.
- Limitations.
- What the system cannot conclude.

---

# 26. Development Actions

## 26.1 Optional Personal Coaching Action

AI may suggest an action with:

- Recommendation.
- Reason.
- Supporting pattern.
- Expected impact.
- Example implementation.
- Suggested completion evidence.

The employee may:

- Accept.
- Modify.
- Defer.
- Reject.
- Mark private.
- Share with the manager.
- Convert to a formal plan.

## 26.2 Privacy

Before acceptance, the manager does not see the suggestion.

After acceptance:

- Shared action: manager sees title, status, and optional target date.
- Private action: manager sees nothing.
- Rejection reason and personal notes remain private.

## 26.3 Manager Interaction

For a shared action, the manager may:

- Add supportive comments.
- Suggest training.
- Suggest a resource.
- Suggest a project for application.

The manager may not:

- Edit the action.
- Change its status.
- Change its date.
- Convert it to a formal development plan without employee approval.

## 26.4 Formal Development Plan

A formal plan may be created after evaluation.

It includes:

- Development area.
- Reason.
- Expected behavior.
- Activity.
- Training or application.
- Responsible follow-up.
- Target date.
- Completion evidence.
- Status.

---

# 27. Leave, Delegation, and Continuity

## 27.1 Leave Registration

The employee records leave dates in the system.

The manager approves the leave record.

The system does not manage:

- Leave balance.
- HR entitlement.
- Payroll impact.
- Formal HR approval.

The approved record is used only for:

- Notifications.
- Check-ins.
- Delegation.
- Evaluation timing.
- Analytics exclusion.

## 27.2 Leave Effects

During approved leave:

- Weekly updates are not required from the employee.
- Missing-update alerts are suspended.
- The period is excluded from response and regularity analytics.
- Employee self-assessment may be postponed.
- The employee’s upward evaluation may be postponed until return or excluded from the cycle by the manager before the cycle closes.
- Postponement or exclusion does not delay visibility of other employees’ submitted evaluations.
- In the pilot `Identified` mode, each response becomes visible to the manager immediately after submission, including employee identity, criterion ratings, written comments, and submission timestamp.
- The manager can see which eligible employees have submitted, which have not submitted, and which are on approved leave or excluded from the cycle.

## 27.3 Handover Update

Before planned leave or departure, the employee prepares a Handover Update for each project or Workstream requiring continuity.

Minimum content:

- Current status.
- Completed work.
- Open work.
- Blockers and risks.
- Immediate next step.
- Key links and repositories.
- Required access.
- Pending decisions and external responses.
- Proposed delegate.
- Delegation period.

AI checks completeness.

The manager approves the delegation decision, not the technical content.

## 27.4 Delegation Activation

1. Manager approves delegation.
2. Delegate reviews the Handover.
3. Delegate confirms receipt and access.
4. Delegate may report missing information or access.
5. Delegate cannot cancel the management decision.
6. Delegation becomes Active after confirmation.

For emergencies, the manager may activate immediately with a recorded reason.

## 27.5 Acting Owner

During active delegation, the delegate acts as full owner for the delegated Project or Workstream.

They may:

- Update documents.
- Add updates and evidence.
- Change status.
- Approve revised dynamic criteria.
- Manage participants.
- Record decisions.
- Handle repositories and sources.
- Close stages.
- Perform all operational owner actions.

All activity is marked as occurring during delegation.

## 27.6 Attribution During Delegation

Every contribution and decision during delegation is attributed to the Acting Owner or actual contributor.

The original owner is not responsible for decisions made during approved leave.

The original owner does not automatically receive credit for results produced during the delegation.

Each employee is evaluated for the period and work they actually owned.

## 27.7 Return Handover

At the end of leave:

1. Acting Owner creates a Return Handover.
2. It summarizes completed work, decisions, changes, open work, risks, and next steps.
3. Original Owner confirms receipt.
4. Acting Owner permissions end.
5. Responsibility returns.

If confirmation does not occur:

- Manager may finalize return.
- Manager may extend delegation.
- Manager may transfer ownership permanently.

---

# 28. Responsibility Windows

The system records Responsibility Windows for Projects and Workstreams.

A window includes:

- Employee.
- Responsibility type:
  - Original Owner.
  - Acting Owner.
  - Permanent Owner.
  - Contributor.
- Scope.
- Start date and time.
- End date and time.
- Reason.
- Manager decision.
- Related Handover.
- Delegation type.

Multiple responsibility windows may overlap when several employees work on the same Project or Workstream.

Evaluation evidence is interpreted using the window active when the work occurred.

---

# 29. Employee Departure and Offboarding

## 29.1 Account Deactivation

The System Administrator may deactivate an employee account immediately when necessary.

The System Administrator does not decide project reassignment.

## 29.2 Manager Responsibility

The manager decides:

- New owner.
- Pause.
- Closure.
- Merge.
- Permanent reassignment.

## 29.3 Reassignment Required

If an account is disabled before reassignment:

- Active Projects and Workstreams move to `Reassignment Required`.
- The manager sees a critical alert.
- The System Administrator does not assign the replacement.
- The former employee remains visible as historical owner and contributor.

## 29.4 Data Retention

The system retains:

- Contributions.
- Project history.
- Evidence.
- Evaluation records.
- Reservations.
- Development plans.
- Leave and delegation history.

The profile may be archived or hidden from operational lists.

Future deployments may configure retention by organization and data type.

---

# 30. Roles and Permissions

## 30.1 Employee

Can:

- View assigned Projects and Workstreams.
- Add text, voice, file, link, and image updates.
- Review suggested GitHub evidence.
- Add and confirm contributions.
- Review dynamic criteria.
- Object with reasons.
- Complete self-assessment.
- View comparison when opened.
- Record reservation.
- Manage personal development actions.
- Evaluate the manager.
- Register leave.
- Prepare Handover.

## 30.2 Manager

Can:

- Manage department Projects and Workstreams.
- Assign owners and contributors.
- Approve leave and delegation.
- Evaluate employees.
- Set final employee ratings.
- Create and activate department templates for future cycles.
- Set weights within organization rules.
- View team Coaching Insights.
- View identified upward-evaluation completion, ratings, comments, and timestamps in the pilot.
- View optional manager-feedback aggregates and trends.
- Manage project reassignment.
- Support shared development actions.
- View operational Documentation Readiness states.

Cannot:

- See employee Documentation Readiness percentages or readiness ranking.
- Change the manager-feedback visibility mode during an active cycle.
- Claim the pilot manager evaluation is anonymous.
- Change an active evaluation template.
- Change another department’s template.
- Modify a private development action.
- Automatically resolve attribution records as fact.

## 30.3 Primary Project Owner

Can:

- Maintain Project Master Document.
- Maintain project state.
- Perform project weekly check-in.
- Coordinate cross-workstream issues.
- Manage project-level sources.

Has no employee evaluation or supervisory authority.

## 30.4 Primary Workstream Owner

Can:

- Maintain Workstream Document.
- Maintain Workstream state.
- Perform workstream weekly check-in.
- Review proposed Workstream criteria.
- Coordinate handover.

Has no employee evaluation or supervisory authority.

## 30.5 Contributor

Can:

- Add updates.
- Add evidence.
- Describe contribution.
- Review Workstream criteria.
- Acknowledge or object.
- Participate in attribution clarification.

## 30.6 System Administrator

Can:

- Manage users and technical roles.
- Manage organization templates.
- Manage localization versions.
- Manage integrations.
- Manage AI providers and routing.
- Manage manager-feedback visibility configuration for future cycles.
- Manage retention settings.
- Access audit logs.
- Deactivate accounts.
- Create configuration overrides.
- Operate restricted access workflows when a future private feedback mode requires them.

Cannot:

- Decide project reassignment.
- Change the feedback visibility mode during an active cycle.
- Evaluate employees as manager unless separately assigned a distinct managerial role outside the pilot separation.
- Modify historical records without audit.

---

# 31. AI Responsibilities

AI may:

- Analyze project and Workstream documents.
- Identify missing required sections.
- Compare versions.
- Generate dynamic criteria.
- Analyze text and voice updates.
- Analyze images and files.
- Suggest evidence.
- Structure contribution records.
- Identify missing context.
- Ask one question at a time.
- Link evidence to criteria.
- Summarize cycle work.
- Compare self and manager assessments.
- Prepare discussion agendas.
- Generate Coaching Insights.
- Suggest optional development actions.
- Summarize identified upward-evaluation responses in the pilot and apply privacy-safe aggregation when a future private mode requires it.
- Analyze longitudinal trends.

AI may not:

- Assign performance ratings.
- Recommend a rating.
- Approve dynamic criteria without human review.
- Approve final evaluation.
- Resolve attribution disputes as fact.
- Rank employees.
- Convert activity quantity into performance.
- Convert documentation quality into performance.
- Violate the feedback visibility mode frozen in the cycle.

---

# 32. AI Model Routing

## 32.1 Multi-Model System

The system supports:

- External models.
- Local models.
- On-premise models.
- Different models for different functions.

Possible function routes include:

- Document analysis.
- Criteria generation.
- Code analysis.
- Image analysis.
- Speech-to-text.
- Coaching insights.
- Evaluation preparation.
- Manager-feedback summarization and configurable privacy-preserving aggregation.

## 32.2 Control

Only the System Administrator configures models.

Employees and managers do not choose models and do not need to see provider or model details.

## 32.3 Inheritance Priority

Model routing priority is:

1. Project override.
2. Department override.
3. System default.

## 32.4 Administrator Freedom

The System Administrator has full authority to:

- Add providers.
- Add models.
- Use local or external models.
- Create project or department exceptions.
- Override general policies.
- Set fallbacks.
- Change data routing.

## 32.5 Mandatory Override Justification

Every override requires:

- Reason.
- Scope.
- Previous setting.
- New setting.
- Provider and model.
- Affected data types.
- Effective date.
- Administrator identity.

No second approval is required in the pilot.

The system must prevent saving an override without a documented reason.

## 32.6 Analysis Trace

Internally, each AI-generated analysis stores:

- Model configuration version.
- Provider.
- Route.
- Timestamp.
- Input source references.
- Output version.

Historical outputs are not automatically regenerated when a model changes.

---

# 33. Data, Records, and Audit

## 33.1 Versioned Records

The system maintains versions for:

- Project documents.
- Workstream documents.
- Dynamic criteria.
- Evaluation templates.
- Fixed criteria.
- Behavioral anchors.
- Weights.
- AI routing configurations.
- Privacy policies.
- Retention policies.

## 33.2 Immutable History Principle

Important records are not silently overwritten.

Corrections create new records or revisions while preserving history.

## 33.3 Evaluation Snapshot

A closed evaluation stores:

- Template version.
- Criteria and anchors.
- Weights.
- Evidence available at closure.
- Self-rating.
- Manager rating.
- Final rating.
- Justifications.
- Discussion notes.
- Reservation.
- Closure state.

Later project changes do not alter the closed evaluation.

## 33.4 Audit Events

Audit events include:

- Login-sensitive administrative events.
- Template creation and activation.
- Criteria changes.
- Weight changes.
- Document version changes.
- Dynamic-criteria changes.
- Evidence changes.
- Rating changes.
- Evaluation closure.
- Delegation activation.
- Responsibility transfer.
- Sensitive comment access.
- AI routing override.
- Export actions.

---

# 34. Dashboards

## 34.1 Employee Dashboard

Shows:

- My Work as the employee default home.
- Needs My Action first.
- Today second.
- Overdue third.
- Remaining work groups through progressive disclosure.
- Active Projects and Workstreams.
- Ownership and contributor roles.
- Latest updates.
- Thursday check-in status.
- Monthly Evaluation Readiness Review.
- Missing document requirements.
- Suggested evidence inbox.
- Detailed Documentation Readiness.
- Dynamic criteria.
- Coaching Insights.
- Evaluation cycle status.
- Previous evaluation.
- Development actions.

## 34.2 Manager Dashboard

Prioritizes compact, actionable operational queues rather than oversized metric-only cards. It shows:

- Team members.
- Active Projects and Workstreams.
- Owners and contributors.
- Missing Thursday check-ins.
- Monthly team evidence-readiness gaps.
- Operational documentation states by Project or Workstream.
- Blocked work.
- Reassignment Required items.
- Leave and delegations.
- Open evaluation cycles.
- Assessment completion.
- Rating differences.
- Coaching trends.
- Development plans.
- Identified upward manager evaluations in the pilot.

Employee quick-add and quick-update actions are hidden unless the same user is also acting as an authorized contributor or owner. Documentation Readiness and evaluation remain separate navigation and conceptual paths.

The manager dashboard does not show individual Documentation Readiness percentages, employee readiness percentages, readiness rankings, productivity scores, completion leaderboards, predicted ratings, or employee rankings.

## 34.3 System Administrator Dashboard

Shows:

- Users and roles.
- Organization and department templates.
- Localization versions.
- Integrations.
- GitHub connections.
- AI model routes.
- Overrides.
- Audit logs.
- Privacy-mode configuration for future deployments.
- Retention settings.
- System health.

---

# 35. Reports

## 35.1 Employee Cycle Report

Includes:

- Period summary.
- Cycle type: Calibration or Official Baseline.
- Projects and Workstreams.
- Responsibility windows.
- Research and learning.
- Experiments.
- Implementation.
- Evidence.
- Self-assessment.
- Manager assessment.
- Differences.
- Final rating.
- Reservation.
- Development plan.

## 35.2 Manager Upward Evaluation Report — Pilot

Includes:

- Employee name.
- Completion status.
- Individual criterion ratings.
- Individual comments.
- Submission time.
- Aggregated criterion results.
- Repeated topic summaries.
- Strengths.
- Improvement areas.
- Trend against previous cycles.
- Leadership development plan.

Future privacy modes may produce a blinded or aggregated report instead.

## 35.3 Department Report

May include:

- Evaluation distribution.
- Criterion trends.
- Skills gaps.
- Research and learning themes.
- Innovation patterns.
- Operational documentation states.
- Recurring blockers.
- Training needs.
- Project-type patterns.

It must not create a superficial employee ranking.

---

# 36. Product Configuration Model

The product must support configurable:

- Organizations.
- Departments.
- Roles.
- Levels.
- Project templates.
- Workstream templates.
- Evaluation templates.
- Rating scales.
- Fixed criteria.
- Mandatory global criteria.
- Weight ranges.
- Dynamic criteria rules.
- Evaluation cadence.
- Weekly check-in day.
- Monthly readiness-review schedule.
- Manager-evaluation visibility mode.
- Upward-evaluation completion rule.
- Sensitive-access approval workflow for private modes.
- Localization and RTL.
- Retention.
- AI routing.
- Data-source integrations.

The pilot uses:

- One organization.
- One department.
- Flat employee level.
- Thursday check-ins.
- Monthly Evaluation Readiness Review.
- Quarterly evaluation in year one.
- Cycle 1 as `Calibration — Non-Baseline`.
- One manager.
- One separate System Administrator.
- `Identified` upward manager evaluation.
- Visible completion status, ratings, and comments.
- English-only pilot use is permitted; Arabic employee use remains gated by approved Arabic rubric content and semantic review.
- 1-to-5 rating scale.

## 36.1 Localization Governance

English-only pilot use is permitted. Arabic employee use requires approved Arabic rubric content and semantic review. Existing localization and RTL foundations remain in the product for the future Arabic release.

Requirements:

- An approved English version of every criterion and Behavioral Anchor for English pilot use.
- Approved Arabic versions of every criterion and Behavioral Anchor before Arabic employee use.
- The same stable Criterion ID and version across languages.
- A translation cannot be activated independently if it changes the meaning of the approved source.
- RTL layout for Arabic.
- Correct mixed Arabic/English technical text.
- Arabic PDF, DOCX, voice, image, and report handling.
- Gulf and Levantine Arabic speech fixtures in the AI evaluation suite.
- Arabic UI and AI-output quality tests.

The Arabic translation must be reviewed for criterion meaning, not only linguistic fluency.

# 37. Core Build Versus Future Configuration

## 37.1 Core Build

The first complete system should include:

- Users, roles, and department.
- Projects and Workstreams.
- Project and Workstream documents.
- Versioning.
- Dynamic criteria.
- Updates and Thursday check-ins.
- Evidence and images.
- GitHub synchronization and suggested evidence.
- Contribution attribution and disputes.
- Employee evaluation.
- Manager upward evaluation.
- Coaching Insights.
- Development actions.
- Leave, delegation, and handover.
- Responsibility windows.
- Account deactivation and reassignment.
- Templates, weights, criteria, and anchors.
- AI model routing.
- Audit logs.
- Dashboards and reports.

## 37.2 Configurable but Not Hardcoded

- Evaluation cadence.
- Criteria.
- Weights.
- Anchors.
- Project document structure.
- Workstream document structure.
- AI providers and models.
- Privacy rules.
- Retention rules.
- Approval rules.
- Mandatory global criteria.

## 37.3 Deferred

The following are not required in the first build:

- Commercial SaaS billing.
- Subscription plans.
- Template marketplace.
- Full multi-tenant administration.
- Formal second-level employee appeal.
- Google Drive automatic synchronization.
- HR system integration.
- Multi-party sensitive-access approval.
- Automated payroll or promotion workflows.
- Employee ranking.
- Automated final rating.

---

# 38. Approved Decisions

The following decisions are approved:

- Pilot is internal to the AI Department.
- Product must remain adaptable to other departments and companies.
- Team is flat in the pilot.
- Same fixed expectations apply to pilot employees.
- Project context is handled through dynamic criteria and contribution evidence.
- Project documentation is mandatory.
- Every measurable Project, and every separately measurable Workstream, uses a versioned and human-approved Progress Contract derived from its approved source document.
- Official progress is calculated only from approved measurable milestones, deliverables, operational KPIs, acceptance conditions, and their confirmed values.
- Work Item completion, task volume, update frequency, GitHub activity, commits, files, and lines changed do not calculate Project or Workstream progress.
- The overall progress percentage cannot be entered or overridden directly; authorized human confirmation is limited to qualitative conditions already defined by the approved contract.
- Project and Workstream progress is operational status, not employee performance.
- Projects may contain Workstreams.
- Each Project has one Primary Project Owner.
- Each Workstream has one Primary Workstream Owner.
- Owners are coordinators, not supervisors.
- Every Workstream has one shared document.
- Employees record individual contributions separately.
- Project criteria are limited to one to three.
- Workstream criteria are limited to two to three.
- Project Contribution has a fixed section weight.
- No automatic average across Projects or Workstreams.
- Thursday weekly check-ins are mandatory when no substantive update exists.
- Employee updates use a multi-turn clarification flow, show one AI question at a time, and require employee edit and confirmation before becoming append-only timeline events.
- Manual evidence is available inside the update flow and requires employee confirmation.
- A Monthly Evaluation Readiness Review identifies thin evidence before quarter-end without imposing evidence quotas.
- Images are valid evidence when contextualized.
- GitHub activity is suggested evidence only.
- Cycle 1 is a Calibration — Non-Baseline cycle.
- English-only pilot use is permitted; Arabic employee use requires approved Arabic rubric content, semantic review, and RTL support.
- The manager sees operational Documentation Readiness states but not employee percentages or rankings.
- Evaluation Fact View is shown before emphasizing employee narrative.
- Commit count is not performance.
- Documentation readiness is not performance.
- AI does not assign ratings.
- Evaluation is quarterly in year one.
- The manager decides final employee ratings.
- Employee reservation does not block closure.
- Manager upward evaluation is quarterly in year one.
- The pilot upward evaluation is identified and transparent.
- The manager sees who submitted, who did not submit, individual ratings, and comments.
- The pilot has no anonymity publication gate.
- Future organizations may configure Identified, Manager-Blinded, or Anonymous Aggregated modes.
- Manager and System Administrator remain separate technical roles.
- Coaching Insights are continuous and non-scoring.
- Personal development actions may remain private.
- Leave suspends check-in and evaluation requirements.
- Delegates receive full Acting Owner powers during active delegation.
- Responsibility and credit follow the actual responsibility period.
- Return Handover is required.
- Account deactivation may occur before reassignment.
- Reassignment is a manager responsibility.
- System Administrator controls AI routing.
- Model routing supports system, department, and project override.
- Administrator overrides require a recorded reason.
- Historical records remain after employee departure.
- Manager can create and activate department evaluation templates for future cycles.
- Mandatory global criteria cannot be removed.
- Mandatory global criteria may have allowed weight ranges.
- Fixed-section and fixed-criterion weights are used.
- Dynamic project/workstream criteria are not automatically weighted into a hidden formula.

---

# 39. Assumptions

The following remain assumptions until implementation planning confirms them:

- GitHub is the primary synchronized external source in the first build.
- Project and Workstream documents can be represented in formats that AI can reliably parse.
- The pilot team will consistently use documents and updates.
- The manager will perform all employee evaluations.
- A separate trusted System Administrator will exist.
- The first deployment does not require enterprise HR integration.
- The first deployment can operate without commercial SaaS tenant features.
- The AI-model provider environment will be configured by the organization.

---

# 40. Active Risks

## 40.1 Workflow Burden

Risk: Excessive documentation or check-ins may reduce adoption.

Mitigation:

- Thursday check-ins are lightweight.
- Substantive updates replace the check-in.
- AI structures updates.
- Document changes are required only for material project changes.

## 40.2 Criteria Overlap

Risk: Research, initiative, applied learning, engineering, and projects may double-count the same work.

Mitigation:

- Approved boundary rules.
- Final criteria audit before weighting.
- One Project Contribution section without automatic project averages.

## 40.3 AI Bias or Instability

Risk: Different models may produce different summaries or criteria.

Mitigation:

- Model configuration versioning.
- Human approval.
- No AI rating.
- Source-reference retention.
- Audit of model route.

## 40.4 Upward Evaluation Candor

Risk: Because the pilot is identified, employees may soften criticism or avoid direct feedback.

Mitigation:

- Communicate the identified mode clearly before submission.
- Use behavior-based prompts.
- Prohibit retaliation.
- Preserve comments and ratings accurately.
- Allow future organizations to choose Manager-Blinded or Anonymous Aggregated modes.
- Review candor and trust after the calibration cycle.

## 40.5 Attribution Conflict

Risk: Employees may dispute shared contribution.

Mitigation:

- Self-reported status.
- Peer acknowledgment.
- Disputed state.
- Manager judgment at evaluation without rewriting history.

## 40.6 Configuration Complexity

Risk: Product configurability may create a complex administration interface.

Mitigation:

- Defaults.
- Inheritance.
- Versioning.
- Scope-limited manager control.
- Advanced controls restricted to System Administrator.

## 40.7 Overreliance on Activity Volume

Risk: Updates, commits, and project count may be interpreted as performance.

Mitigation:

- Explicit prohibition.
- Coaching-only patterns.
- No automatic ranking.
- Human final judgment.

---

# 41. Open Implementation and Release Decisions

The core product is ready for implementation.

The following implementation-level decisions remain and must be resolved during the relevant tasks:

1. Final approved Arabic translation of the 12 employee criteria, 60 anchors, Project Contribution anchors, and five manager criteria. This gates Arabic employee release only and does not block Phase 0 completion or later engineering phases.
2. Exact Thursday reminder times.
3. Exact monthly readiness-review day.
4. Selected external and local AI providers for the pilot environment.
5. Deployment environment and identity-provider hosting.
6. Maximum file sizes and supported media limits.
7. Which future manager-feedback privacy modes are enabled in the first productized release.

These are tracked implementation decisions, not reasons to reopen the full product design.

# 42. Recommendations

## 42.1 Product Recommendation

Build the system as:

> A simple user-facing internal platform with modular configuration, versioned records, and explicit human approval boundaries.

## 42.2 Architecture Recommendation

Use a modular internal architecture with clear separation between:

- Identity and permissions.
- Project and Workstream management.
- Documents and versioning.
- Updates and evidence.
- Evaluation.
- Manager upward evaluation.
- Coaching.
- Leave and delegation.
- AI orchestration and model routing.
- Audit and privacy.

The interface should remain simple even when the internals are modular.

## 42.3 Implementation Recommendation

Do not build every future configuration surface first.

Build the pilot end-to-end with:

- Configuration foundations.
- One organization.
- One department.
- One employee template.
- One manager template.
- GitHub integration.
- One complete quarterly cycle.

Then expand configuration depth after the pilot workflow is proven.

## 42.4 Evaluation Recommendation

Complete the evaluation-rubric artifact before coding the final evaluation UI.

The rubric should define:

- Final criterion wording.
- Definitions.
- Exclusions.
- Rating anchors.
- Evidence guidance.
- Examples.
- Initial weights.

## 42.5 Privacy Recommendation

Treat upward-manager evaluation as a configurable governance domain.

The pilot uses identified responses. The architecture must avoid hardcoding this choice so future organizations can activate manager-blinded or anonymous-aggregated modes.

---

# 43. Definition of Done for the Product

The product is functionally complete when it can:

1. Create Projects and Workstreams.
2. Validate required documents.
3. Generate and version dynamic criteria.
4. Track owners, contributors, and responsibility windows.
5. Accept text, voice, file, link, image, and GitHub evidence.
6. Run Thursday check-ins.
7. Maintain full timelines.
8. Support leave, delegation, Handover, and Return Handover.
9. Configure and freeze evaluation templates.
10. Run self-assessment.
11. Run independent manager assessment.
12. Compare assessments.
13. Support discussion.
14. Save manager final ratings.
15. Record employee acknowledgment or reservation.
16. Close and preserve cycles.
17. Run identified upward manager evaluation in the pilot.
18. Show employee-level completion, ratings, comments, and timestamps to the manager in the pilot while supporting configurable future privacy modes.
19. Generate continuous Coaching Insights without scoring.
20. Support private and shared development actions.
21. Route AI functions across local and external models.
22. Preserve model-route, configuration, and audit history.
23. Prevent Documentation Score from becoming Performance Score.
24. Prevent raw activity count from becoming performance.
25. Support future adaptation to other departments and organizations.

---

# 44. Authoritative Summary

The system is an evidence-supported, human-decided performance evaluation platform built around real project work.

Its operating backbone is:

> Project Master Document → Workstream Documents → Activity Timelines → Evidence → Dynamic Criteria → Quarterly Human Evaluation → Coaching and Development.

Its governance backbone is:

> Configurable Templates → Versioned Expectations → Separation of Roles → Privacy Controls → Auditability.

Its product direction is:

> Build for the LeapAI AI Department now, while preserving a clear path to a configurable product for other departments and companies.
