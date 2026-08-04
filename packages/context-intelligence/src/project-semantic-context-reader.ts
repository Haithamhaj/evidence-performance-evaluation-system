type Actor = Readonly<{ userId: string; active: boolean }>;

export type ApprovedProjectSemanticContext = Readonly<{
  projectId: string;
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  sourceReferences: readonly string[];
  purpose: readonly string[];
  outcomes: readonly string[];
  milestones: readonly string[];
  deliverables: readonly string[];
  terminology: readonly string[];
  stakeholders: readonly string[];
  operationalKpis: readonly string[];
  acceptanceConditions: readonly string[];
  evidenceRequirements: readonly string[];
}>;

export interface ApprovedProjectSemanticContextPublicReader {
  readApprovedProjectSemanticContext(
    input: Readonly<{
      actor: Actor;
      projectId: string;
    }>,
  ): Promise<ApprovedProjectSemanticContext | null>;
}

export class ProjectSemanticContextReader {
  private readonly documents: ApprovedProjectSemanticContextPublicReader;

  constructor(documents: ApprovedProjectSemanticContextPublicReader) {
    this.documents = documents;
  }

  async read(
    input: Readonly<{
      actor: Actor;
      projectId: string;
    }>,
  ): Promise<ApprovedProjectSemanticContext | null> {
    const approved = await this.documents.readApprovedProjectSemanticContext(input);
    if (approved === null) return null;
    if (approved.projectId !== input.projectId) {
      throw new Error("Approved Project document scope mismatch");
    }
    return {
      projectId: approved.projectId,
      documentId: approved.documentId,
      documentVersionId: approved.documentVersionId,
      documentVersion: approved.documentVersion,
      sourceReferences: [...approved.sourceReferences],
      purpose: [...approved.purpose],
      outcomes: [...approved.outcomes],
      milestones: [...approved.milestones],
      deliverables: [...approved.deliverables],
      terminology: [...approved.terminology],
      stakeholders: [...approved.stakeholders],
      operationalKpis: [...approved.operationalKpis],
      acceptanceConditions: [...approved.acceptanceConditions],
      evidenceRequirements: [...approved.evidenceRequirements],
    };
  }
}
