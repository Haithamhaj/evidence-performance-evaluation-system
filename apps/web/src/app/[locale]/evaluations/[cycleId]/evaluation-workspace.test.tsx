/* eslint-disable no-unused-vars */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getCatalogSync } from "@evaluation/localization";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  EvaluationCriterion,
  EvaluationFactSummary,
  EvaluationJourney,
} from "./evaluation-experience-contracts.js";
import { EvaluationWorkspace } from "./evaluation-workspace.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe("EvaluationWorkspace", () => {
  it("offers an editable assistant draft only after the employee chooses the rating", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: "evaluation-justification.v1",
          draft: "I delivered the protected flow and verified its recovery path.",
          sourceReferences: ["40000000-0000-4000-8000-000000000001"],
          limitations: ["Review and edit before saving."],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={journey({ oneCriterion: true })}
        locale="en"
      />,
    );

    expect(screen.queryByRole("button", { name: "Draft reflection with assistant" })).toBeNull();
    fireEvent.click(
      screen.getByRole("radio", { name: "3 Consistently meets the approved expectation" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Draft reflection with assistant" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Your evidence-based reflection")).toHaveValue(
        "I delivered the protected flow and verified its recovery path.",
      ),
    );
    expect(screen.getByText("Review and edit before saving.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/evaluation/assignments/20000000-0000-4000-8000-000000000001/wording-draft",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.selectedRating).toBe(3);
    expect(body).not.toHaveProperty("suggestedRating");
  });

  it("shows the cycle and source-supported facts before fixed-order human assessment criteria", () => {
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={journey()}
        locale="en"
      />,
    );

    const entry = screen.getByLabelText("Evaluation cycle overview");
    expect(entry).toHaveTextContent("Calibration — Non-Baseline");
    expect(entry).toHaveTextContent("Self assessment");
    expect(entry).toHaveTextContent("Identified");
    expect(entry).toHaveTextContent("30 September 2026");

    const facts = screen.getByLabelText("Source-supported facts");
    const assessment = screen.getByLabelText("Your self assessment");
    expect(
      facts.compareDocumentPosition(assessment) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(facts).toHaveTextContent("Delivered the protected API flow");
    expect(facts).toHaveTextContent("Validated retrieval against the Project constraints");
    expect(facts).toHaveTextContent("One claim still needs a source");
    expect(facts).toHaveTextContent(
      "Preparation assistant: facts, gaps, and editable wording only",
    );

    const criterionButtons = screen
      .getAllByRole("button", { name: /Quality and reliability|Project contribution/ })
      .map(({ textContent }) => textContent);
    expect(criterionButtons).toEqual([
      "01Quality and reliabilityNot started",
      "02Project contributionNot started",
    ]);
    expect(screen.getByLabelText("Rating anchors for Quality and reliability")).toHaveTextContent(
      "3Consistently meets the approved expectation",
    );
    expect(
      screen.getByText("You choose the rating. The assistant never recommends one."),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /readiness percentage|recommended rating|predicted rating/i,
    );
  });

  it("never lets assistant wording reorder the approved criterion sequence", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: "evaluation-justification.v1",
          draft: "Editable wording only.",
          sourceReferences: [],
          limitations: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={journey()}
        locale="en"
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: "3 Consistently meets the approved expectation" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Draft reflection with assistant" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Your evidence-based reflection")).toHaveValue(
        "Editable wording only.",
      ),
    );

    expect(
      screen
        .getAllByRole("button", { name: /Quality and reliability|Project contribution/ })
        .map(({ textContent }) => textContent),
    ).toEqual(["01Quality and reliabilityComplete", "02Project contributionNot started"]);
  });

  it("keeps the assessment compact by opening one criterion at a time and preserving progress", () => {
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={journey()}
        locale="en"
      />,
    );

    expect(screen.getByLabelText("Rating anchors for Quality and reliability")).toBeVisible();
    expect(screen.queryByLabelText("Rating anchors for Project contribution")).toBeNull();

    fireEvent.click(
      screen.getByRole("radio", { name: "3 Consistently meets the approved expectation" }),
    );
    fireEvent.change(screen.getByLabelText("Your evidence-based reflection"), {
      target: { value: "I verified the delivery and recovery path." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next criterion" }));

    expect(screen.queryByLabelText("Rating anchors for Quality and reliability")).toBeNull();
    expect(screen.getByLabelText("Rating anchors for Project contribution")).toBeVisible();
    expect(screen.getByText("1/2 complete")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Quality and reliability/ }));
    expect(screen.getByLabelText("Your evidence-based reflection")).toHaveValue(
      "I verified the delivery and recovery path.",
    );
  });

  it("saves an employee-selected rating and editable justification without an AI rating field", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "saved",
            version: 2,
            updatedAt: "2026-08-15T12:00:00Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "submitted", confirmedAt: "2026-08-15T12:05:00Z" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={journey({ oneCriterion: true })}
        locale="en"
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: "3 Consistently meets the approved expectation" }),
    );
    fireEvent.change(screen.getByLabelText("Your evidence-based reflection"), {
      target: { value: "I delivered the protected flow and verified the recovery path." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Draft saved"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/evaluation/assignments/20000000-0000-4000-8000-000000000001/self-draft",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      expectedVersion: 1,
      entries: [
        {
          criterionId: "30000000-0000-4000-8000-000000000001",
          rating: 3,
          justification: "I delivered the protected flow and verified the recovery path.",
          sourceReferences: [],
          directObservationBasis: null,
        },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/suggestedRating|recommendedRating|aiRating/i);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "I reviewed every rating and reflection" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit self assessment" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Assessment submitted"),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/evaluation/assignments/20000000-0000-4000-8000-000000000001/self-submit",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      expectedVersion: 2,
      reviewed: true,
    });
  });

  it("keeps the manager draft independent and records direct observation through the protected manager path", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: "saved", version: 2, updatedAt: "2026-08-15T12:00:00Z" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const managerJourney: EvaluationJourney = {
      ...journey({ oneCriterion: true }),
      audience: "assigned_manager",
      cycle: { ...journey().cycle, state: "MANAGER_ASSESSMENT" },
    };
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={managerJourney}
        locale="en"
      />,
    );

    expect(document.body).not.toHaveTextContent("Employee: 3");
    fireEvent.click(
      screen.getByRole("radio", { name: "3 Consistently meets the approved expectation" }),
    );
    fireEvent.change(screen.getByLabelText("Your evidence-based reflection"), {
      target: { value: "My independent assessment reflects the observed delivery." },
    });
    fireEvent.change(screen.getByLabelText("Direct observation basis"), {
      target: { value: "Observed the recovery rehearsal and handover directly." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Draft saved"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/evaluation/assignments/20000000-0000-4000-8000-000000000001/manager-draft",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.entries[0].directObservationBasis).toBe(
      "Observed the recovery rehearsal and handover directly.",
    );
  });

  it("shows submitted positions for discussion without midpoint or recommendation", () => {
    const entry = {
      criterionId: "30000000-0000-4000-8000-000000000001",
      rating: 3 as const,
      justification: "Human position.",
      sourceReferences: [],
      directObservationBasis: null,
    };
    const compared: EvaluationJourney = {
      ...journey({ oneCriterion: true }),
      audience: "assigned_manager",
      cycle: { ...journey().cycle, state: "COMPARISON" },
      submissions: [
        { kind: "SELF", submittedAt: "2026-08-15T12:00:00Z", entries: [entry] },
        {
          kind: "MANAGER_INITIAL",
          submittedAt: "2026-08-15T12:05:00Z",
          entries: [{ ...entry, rating: 4 }],
        },
      ],
      independenceGate: { managerSubmittedBeforeSelfProjection: true },
    };
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={compared}
        locale="en"
      />,
    );

    const comparison = screen.getByLabelText("Employee and manager comparison");
    expect(comparison).toHaveTextContent("Employee: 3");
    expect(comparison).toHaveTextContent("Manager: 4");
    expect(comparison).toHaveTextContent("Different positions — discuss the supporting facts");
    expect(comparison).toHaveTextContent("It never calculates a midpoint or recommends a rating");
    expect(comparison).not.toHaveTextContent(/suggested result|calculated result/i);
  });

  it("lets the manager record the final human decision without an AI rating field", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "finalized",
          finalizedAt: "2026-08-15T13:00:00Z",
          version: 2,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const entry = submittedEntry(3);
    const finalizationJourney: EvaluationJourney = {
      ...journey({ oneCriterion: true }),
      audience: "assigned_manager",
      cycle: { ...journey().cycle, state: "FINALIZATION" },
      submissions: [
        { kind: "SELF", submittedAt: "2026-08-15T12:00:00Z", entries: [entry] },
        { kind: "MANAGER_INITIAL", submittedAt: "2026-08-15T12:05:00Z", entries: [entry] },
      ],
      independenceGate: { managerSubmittedBeforeSelfProjection: true },
    };
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={finalizationJourney}
        locale="en"
      />,
    );

    expect(screen.getByLabelText("Final human decision")).toHaveTextContent(
      "The manager decides every final rating",
    );
    fireEvent.change(screen.getByLabelText("Final comment"), {
      target: { value: "Final judgment recorded after reviewing both positions." },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "I confirm these are my final human decisions" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Finalize evaluation" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Finalized"));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/evaluation/assignments/${finalizationJourney.assignment.id}/finalize`,
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.entries).toEqual([
      {
        criterionId: entry.criterionId,
        rating: 3,
        justification: entry.justification,
        sourceReferences: [],
        managerInitialChangeReason: null,
      },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/aiRating|suggestedRating|recommendedRating/i);
  });

  it("records an employee reservation without changing the final manager decision", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "acknowledged", recordedAt: "2026-08-15T14:00:00Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const acknowledgmentJourney: EvaluationJourney = {
      ...journey({ oneCriterion: true }),
      cycle: { ...journey().cycle, state: "ACKNOWLEDGMENT" },
      finalDecision: {
        humanManagerDecision: true,
        entries: [submittedEntry(4)],
        finalComment: "Manager final judgment.",
        finalizedAt: "2026-08-15T13:00:00Z",
      },
    };
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={acknowledgmentJourney}
        locale="en"
      />,
    );

    expect(screen.getByLabelText("Final manager decision")).toHaveTextContent("Rating 4");
    fireEvent.click(screen.getByLabelText("Acknowledge with reservation"));
    fireEvent.change(screen.getByLabelText("Reservation"), {
      target: { value: "I acknowledge receipt and disagree with the context used." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record acknowledgment" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Acknowledged"));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      expectedVersion: 1,
      kind: "ACKNOWLEDGED_WITH_RESERVATION",
      reservation: "I acknowledge receipt and disagree with the context used.",
    });
    expect(body).not.toHaveProperty("rating");
  });

  it("queues an English self export from the immutable decision", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: "queued", requestId: "70000000-0000-4000-8000-000000000004" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const exportJourney: EvaluationJourney = {
      ...journey({ oneCriterion: true }),
      finalDecision: {
        humanManagerDecision: true,
        entries: [submittedEntry(3)],
        finalComment: null,
        finalizedAt: "2026-08-15T13:00:00Z",
      },
    };
    render(
      <EvaluationWorkspace
        catalog={getCatalogSync("en")}
        factView={factView()}
        journey={exportJourney}
        locale="en"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prepare export" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Export queued"));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/evaluation/assignments/${exportJourney.assignment.id}/export`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});

function submittedEntry(rating: 1 | 2 | 3 | 4 | 5) {
  return {
    criterionId: "30000000-0000-4000-8000-000000000001",
    rating,
    justification: "Human judgment grounded in the reviewed context.",
    sourceReferences: [] as string[],
    directObservationBasis: null,
  };
}

function journey(options: { oneCriterion?: boolean } = {}): EvaluationJourney {
  const items = [
    criterion(
      "30000000-0000-4000-8000-000000000001",
      "quality_reliability",
      "Quality and reliability",
      1,
    ),
    criterion(
      "30000000-0000-4000-8000-000000000002",
      "project_contribution",
      "Project contribution",
      2,
    ),
  ];
  return {
    schemaVersion: 1 as const,
    audience: "self" as const,
    cycle: {
      id: "10000000-0000-4000-8000-000000000001",
      type: "CALIBRATION_NON_BASELINE" as const,
      state: "SELF_ASSESSMENT",
      visibilityMode: "identified" as const,
      startsAt: "2026-07-01T00:00:00Z",
      endsAt: "2026-09-30T20:59:59Z",
      version: 2,
    },
    assignment: {
      id: "20000000-0000-4000-8000-000000000001",
      employeeId: "20000000-0000-4000-8000-000000000002",
      managerId: "20000000-0000-4000-8000-000000000003",
      version: 1,
    },
    templateSnapshot: {
      id: "30000000-0000-4000-8000-000000000099",
      versionNumber: 1,
      schemaVersion: 1,
      weightPolicy: {},
      evaluationPolicy: {},
      items: options.oneCriterion ? items.slice(0, 1) : items,
    },
    factViewFirst: {
      responsibilityWindows: [],
      workFacts: [],
      researchFacts: [],
      sourceCoverageNotes: [],
    },
    factView: fullFactView(),
    drafts: [],
    submissions: [],
    comparison: null,
    discussion: [],
    finalDecision: null,
    acknowledgment: null,
    immutableClosedSnapshot: null,
    independenceGate: { managerSubmittedBeforeSelfProjection: false },
  };
}

function criterion(
  id: string,
  stableCriterionId: string,
  title: string,
  displayOrder: number,
): EvaluationCriterion {
  return {
    id,
    stableCriterionId,
    kind: stableCriterionId === "project_contribution" ? "PROJECT_CONTRIBUTION" : "FIXED_CRITERION",
    sectionStableId: "delivery",
    sectionWeight: 100,
    criterionWeight: null,
    displayOrder,
    protectedGlobal: true,
    mandatory: true,
    locales: [
      {
        locale: "en",
        title,
        definition: `Approved definition for ${title}.`,
        anchors: [
          { rating: 1, text: "Does not yet meet the approved expectation" },
          { rating: 2, text: "Partially meets the approved expectation" },
          { rating: 3, text: "Consistently meets the approved expectation" },
          { rating: 4, text: "Often exceeds the approved expectation" },
          { rating: 5, text: "Consistently demonstrates the highest approved anchor" },
        ],
        examples: [],
        evidenceGuidance: [],
      },
    ],
  };
}

function factView(): EvaluationFactSummary {
  return {
    schemaVersion: 2 as const,
    projectFacts: [
      {
        sourceId: "40000000-0000-4000-8000-000000000001",
        summary: "Delivered the protected API flow",
        result: "Recovery path verified",
        verificationState: "source_supported",
      },
    ],
    confirmedEvidence: [],
    researchFacts: [
      {
        sourceId: "40000000-0000-4000-8000-000000000002",
        summary: "Validated retrieval against the Project constraints",
        verificationState: "source_supported",
      },
    ],
    responsibilityWindows: [],
    dynamicCriteriaVersions: [],
    sourceCoverageNotes: [
      {
        code: "missing_source",
        messageKey: "One claim still needs a source",
        neutral: true,
      },
    ],
  };
}

function fullFactView(): import("@evaluation/contracts/evaluation-fact-view").EvaluationFactView {
  return {
    schemaVersion: 2,
    cycle: {
      id: "10000000-0000-4000-8000-000000000001",
      startsAt: "2026-07-01T00:00:00Z",
      endsAt: "2026-09-30T20:59:59Z",
      rubricVersionId: "50000000-0000-4000-8000-000000000001",
    },
    subjectEmployeeId: "20000000-0000-4000-8000-000000000002",
    generatedAt: "2026-08-15T12:00:00Z",
    responsibilityWindows: [],
    projectFacts: [
      {
        kind: "source_fact",
        sourceType: "project_contribution",
        sourceId: "40000000-0000-4000-8000-000000000001",
        sourceOccurredAt: "2026-08-14T12:00:00Z",
        projectId: "60000000-0000-4000-8000-000000000001",
        workstreamId: null,
        relatedWorkItemId: null,
        criterionStableId: null,
        criterionVersionId: null,
        summary: "Delivered the protected API flow",
        result: "Recovery path verified",
        verificationState: "source_supported",
        attributionState: "employee_confirmed",
        responsibilityWindowIds: [],
        sourceReferences: [
          {
            sourceType: "timeline_event",
            sourceId: "40000000-0000-4000-8000-000000000001",
            sourceVersion: 1,
            occurredAt: "2026-08-14T12:00:00Z",
            url: null,
          },
        ],
      },
    ],
    confirmedEvidence: [],
    checkInFacts: [],
    dynamicCriteriaVersions: [],
    researchFacts: [],
    employeeInterpretations: [],
    sourceCoverageNotes: [],
  };
}
