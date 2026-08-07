import {
  AppError,
  AddEvaluationDiscussionEntryInputSchema,
  EvaluationAiWordingRequestSchema,
  SaveAssessmentDraftInputSchema,
  SubmitAssessmentInputSchema,
} from "@evaluation/contracts";
import {
  AssessmentService,
  EvaluationDiscussionService,
  EvaluationWordingService,
} from "@evaluation/employee-evaluation";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { EmployeeEvaluationPolicyGuard } from "./employee-evaluation-policy.guard.js";
import { EmployeeEvaluationQueryService } from "./employee-evaluation-query.service.js";
import { parseEvaluationInput, parseEvaluationUuid } from "./employee-evaluation-input.js";

type EmployeeEvaluationRequest =
  import("./employee-evaluation-policy.guard.js").EmployeeEvaluationRequest;

export class AssessmentsController {
  private readonly query: EmployeeEvaluationQueryService;
  private readonly assessments: AssessmentService;
  private readonly wording: EvaluationWordingService;
  private readonly discussion: EvaluationDiscussionService;

  constructor(
    query: EmployeeEvaluationQueryService,
    assessments: AssessmentService,
    wording: EvaluationWordingService,
    discussion: EvaluationDiscussionService,
  ) {
    this.query = query;
    this.assessments = assessments;
    this.wording = wording;
    this.discussion = discussion;
  }

  getAssignment(request: EmployeeEvaluationRequest, assignmentId: string): Promise<unknown> {
    return this.query.readAssignment(scope(request, assignmentId));
  }

  getManagerDraft(request: EmployeeEvaluationRequest, assignmentId: string) {
    const authorized = scope(request, assignmentId);
    return this.query.readDraft({ ...authorized, kind: "MANAGER_INITIAL" });
  }

  getSelfAssessment(request: EmployeeEvaluationRequest, assignmentId: string) {
    const authorized = scope(request, assignmentId);
    if (authorized.access === "assigned_manager") {
      return this.assessments.readSelfAssessment({
        assignmentId: authorized.assignmentId,
        managerId: authorized.actorId,
      });
    }
    return this.query.readDraft({ ...authorized, kind: "SELF" });
  }

  saveDraft(request: EmployeeEvaluationRequest, assignmentId: string, body: unknown) {
    const authorized = scope(request, assignmentId);
    const parsed = parseEvaluationInput(
      SaveAssessmentDraftInputSchema.omit({ assignmentId: true, actorId: true }),
      body,
    );
    const requiredKind = authorized.access === "self" ? "SELF" : "MANAGER_INITIAL";
    if (parsed.kind !== requiredKind) throw forbidden();
    return this.assessments.saveDraft({
      ...parsed,
      assignmentId: authorized.assignmentId,
      actorId: authorized.actorId,
    });
  }

  submit(request: EmployeeEvaluationRequest, assignmentId: string, body: unknown) {
    const authorized = scope(request, assignmentId);
    const parsed = parseEvaluationInput(
      SubmitAssessmentInputSchema.omit({ assignmentId: true, actorId: true }),
      body,
    );
    const requiredKind = authorized.access === "self" ? "SELF" : "MANAGER_INITIAL";
    if (parsed.kind !== requiredKind) throw forbidden();
    return this.assessments.submit({
      ...parsed,
      assignmentId: authorized.assignmentId,
      actorId: authorized.actorId,
    });
  }

  draftWording(request: EmployeeEvaluationRequest, assignmentId: string, body: unknown) {
    const authorized = scope(request, assignmentId);
    const parsed = parseEvaluationInput(
      EvaluationAiWordingRequestSchema.omit({ assignmentId: true, actorId: true }),
      body,
    );
    return this.wording.draftJustification({
      ...parsed,
      assignmentId: authorized.assignmentId,
      actorId: authorized.actorId,
    });
  }

  addDiscussion(request: EmployeeEvaluationRequest, assignmentId: string, body: unknown) {
    const authorized = scope(request, assignmentId);
    const parsed = parseEvaluationInput(
      AddEvaluationDiscussionEntryInputSchema.omit({ assignmentId: true, actorId: true }),
      body,
    );
    return this.discussion.add({
      ...parsed,
      assignmentId: authorized.assignmentId,
      actorId: authorized.actorId,
    });
  }
}

Controller("api/v1/employee-evaluation/assignments/:assignmentId")(AssessmentsController);
UseGuards(EmployeeEvaluationPolicyGuard)(AssessmentsController);
Inject(EmployeeEvaluationQueryService)(AssessmentsController, undefined, 0);
Inject(AssessmentService)(AssessmentsController, undefined, 1);
Inject(EvaluationWordingService)(AssessmentsController, undefined, 2);
Inject(EvaluationDiscussionService)(AssessmentsController, undefined, 3);

decorate("getAssignment", Get(), [Req(), Param("assignmentId")]);
decorate("getManagerDraft", Get("manager-draft"), [Req(), Param("assignmentId")]);
decorate("getSelfAssessment", Get("self-assessment"), [Req(), Param("assignmentId")]);
decorate("saveDraft", Post("drafts"), [Req(), Param("assignmentId"), Body()]);
decorate("submit", Post("submissions"), [Req(), Param("assignmentId"), Body()]);
decorate("draftWording", Post("justification-drafts"), [Req(), Param("assignmentId"), Body()]);
decorate("addDiscussion", Post("discussion"), [Req(), Param("assignmentId"), Body()]);

function scope(request: EmployeeEvaluationRequest, assignmentId: string) {
  const parsedId = parseEvaluationUuid(assignmentId);
  const authorization = request.evaluationScope;
  if (authorization === undefined || authorization.assignmentId !== parsedId) throw forbidden();
  const principal = request.principal;
  if (principal?.active !== true) throw forbidden();
  return { ...authorization, actorId: principal.userId };
}

function forbidden() {
  return new AppError("EMPLOYEE_EVALUATION_FORBIDDEN", "errors.evaluation.forbidden", 403);
}

function decorate(
  method: keyof AssessmentsController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(AssessmentsController.prototype, method)!;
  parameters.forEach((parameter, index) =>
    parameter(AssessmentsController.prototype, method, index),
  );
  route(AssessmentsController.prototype, method, descriptor);
}
