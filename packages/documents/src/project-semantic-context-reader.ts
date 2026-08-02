type Actor = Readonly<{ userId: string; active: boolean }>;
type SemanticField =
  | "purpose"
  | "outcomes"
  | "milestones"
  | "deliverables"
  | "terminology"
  | "stakeholders"
  | "operationalKpis"
  | "acceptanceConditions"
  | "evidenceRequirements";

const HEADING_FIELDS = new Map<string, SemanticField>([
  ["project definition and ownership", "purpose"],
  ["problem and context", "purpose"],
  ["purpose", "purpose"],
  ["objective and expected outcome", "outcomes"],
  ["objectives and expected outcomes", "outcomes"],
  ["outcomes", "outcomes"],
  ["milestones", "milestones"],
  ["expected deliverables", "deliverables"],
  ["deliverables", "deliverables"],
  ["terminology", "terminology"],
  ["stakeholders", "stakeholders"],
  ["responsible members", "stakeholders"],
  ["operational kpis", "operationalKpis"],
  ["operational metrics", "operationalKpis"],
  ["definition of success", "acceptanceConditions"],
  ["acceptance conditions", "acceptanceConditions"],
  ["required evidence", "evidenceRequirements"],
  ["evidence requirements", "evidenceRequirements"],
]);

export type DocumentProjectSemanticContext = Readonly<{
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

export class DocumentProjectSemanticContextReader {
  private readonly locator: import("./progress-contract-draft-source-reader.js").ProgressContractDraftSourceLocator;
  private readonly sources: import("./progress-contract-draft-source-reader.js").ApprovedProgressContractDraftSourceReader;

  constructor(
    locator: import("./progress-contract-draft-source-reader.js").ProgressContractDraftSourceLocator,
    sources: import("./progress-contract-draft-source-reader.js").ApprovedProgressContractDraftSourceReader,
  ) {
    this.locator = locator;
    this.sources = sources;
  }

  async readApprovedProjectSemanticContext(input: Readonly<{ actor: Actor; projectId: string }>) {
    const located = await this.locator.locateApprovedProjectVersion(input);
    if (located === null) return null;
    const source = await this.sources.loadApprovedVersion({
      ...input,
      documentVersionId: located.documentVersionId,
      sourceChecksum: located.sourceChecksum,
    });
    if (
      source.projectId !== input.projectId ||
      source.documentVersionId !== located.documentVersionId ||
      source.documentVersion !== located.sourceVersion
    ) {
      throw new Error("Approved Project document lineage mismatch");
    }
    const fields = emptyFields();
    for (const section of source.quotedSections) collectMarkdown(section.text, fields);
    return {
      projectId: source.projectId,
      documentId: source.documentId,
      documentVersionId: source.documentVersionId,
      documentVersion: source.documentVersion,
      sourceReferences: [...source.sourceReferences],
      ...fields,
    } satisfies DocumentProjectSemanticContext;
  }
}

function emptyFields(): Record<SemanticField, string[]> {
  return {
    purpose: [],
    outcomes: [],
    milestones: [],
    deliverables: [],
    terminology: [],
    stakeholders: [],
    operationalKpis: [],
    acceptanceConditions: [],
    evidenceRequirements: [],
  };
}

function collectMarkdown(text: string, fields: Record<SemanticField, string[]>): void {
  let field: SemanticField | undefined;
  for (const rawLine of text.split(/\r?\n/u)) {
    const heading = rawLine.match(/^#{1,6}\s+(.+?)\s*$/u)?.[1];
    if (heading !== undefined) {
      field = HEADING_FIELDS.get(normalizeHeading(heading));
      continue;
    }
    if (field === undefined || fields[field].length >= 20) continue;
    const value = rawLine
      .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/u, "")
      .replace(/\s+/gu, " ")
      .trim();
    if (value.length === 0) continue;
    const bounded = value.slice(0, 500);
    if (!fields[field].includes(bounded)) fields[field].push(bounded);
  }
}

function normalizeHeading(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .replace(/[_–—-]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}
