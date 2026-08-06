export type ResearchSourceKind = "GITHUB" | "PAPER" | "DOCUMENT" | "GENERIC";
export type ResearchSourceLabel =
  | "REPOSITORY_METADATA"
  | "README"
  | "LICENSE"
  | "MANIFEST"
  | "SELECTED_FILE"
  | "CITATION_PAGE"
  | "ABSTRACT_PAGE"
  | "DOCUMENT"
  | "EXPLICIT_PAGE";
export type ResearchSourceRecovery = "UPLOAD_DOCUMENT" | "ADD_MANUAL_CITATION" | "TRY_AGAIN";
export type ResearchRetrievalState = "RETRIEVED" | "PARTIAL" | "BLOCKED";

export type ResearchSourceClassification = Readonly<{
  kind: ResearchSourceKind;
  label: ResearchSourceLabel;
  allowed: boolean;
  recoveryOptions: readonly ResearchSourceRecovery[];
}>;

export type ResearchSourceInterpretation = Readonly<{
  state: ResearchRetrievalState;
  text: string | null;
  reason: string | null;
  recoveryOptions: readonly ResearchSourceRecovery[];
}>;

export type DeterministicSourceResult = Readonly<{
  state: ResearchRetrievalState;
  title: string | null;
  text: string | null;
  reason?: string;
  recoveryOptions?: readonly ResearchSourceRecovery[];
}>;

const GITHUB_MANIFESTS = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "pyproject.toml",
  "requirements.txt",
  "poetry.lock",
  "cargo.toml",
  "cargo.lock",
  "go.mod",
  "go.sum",
  "pom.xml",
  "build.gradle",
  "composer.json",
]);

export function classifyExplicitResearchSource(url: URL): ResearchSourceClassification {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "github.com" || hostname === "www.github.com") return classifyGithub(url);
  if (hostname === "raw.githubusercontent.com") {
    return githubClassification(labelGithubFile(url.pathname.split("/").at(-1) ?? ""));
  }
  if (hostname === "doi.org" || hostname === "dx.doi.org") {
    return allowedClassification("PAPER", "CITATION_PAGE");
  }
  if (hostname === "arxiv.org") {
    return allowedClassification(
      "PAPER",
      url.pathname.startsWith("/abs/") ? "ABSTRACT_PAGE" : "DOCUMENT",
    );
  }
  if (url.pathname.toLowerCase().endsWith(".pdf")) {
    return allowedClassification("PAPER", "DOCUMENT", ["UPLOAD_DOCUMENT", "ADD_MANUAL_CITATION"]);
  }
  if (/\.(?:md|markdown|txt|json)$/iu.test(url.pathname)) {
    return allowedClassification("DOCUMENT", "DOCUMENT", ["ADD_MANUAL_CITATION"]);
  }
  return allowedClassification("GENERIC", "EXPLICIT_PAGE", ["ADD_MANUAL_CITATION"]);
}

export function interpretRetrievedResearchSource(
  input: Readonly<{
    classification: ResearchSourceClassification;
    mimeType: string;
    text: string | null;
    status: ResearchRetrievalState;
    reason?: string | null;
    textTruncated?: boolean;
  }>,
): ResearchSourceInterpretation {
  if (!input.classification.allowed) {
    return {
      state: "BLOCKED",
      text: null,
      reason: input.reason ?? "SOURCE_FORM_NOT_SUPPORTED",
      recoveryOptions: input.classification.recoveryOptions,
    };
  }
  if (input.status === "BLOCKED") {
    return {
      state: "BLOCKED",
      text: null,
      reason: input.reason ?? "SOURCE_UNAVAILABLE",
      recoveryOptions: input.classification.recoveryOptions,
    };
  }
  if (input.mimeType === "application/pdf") {
    return {
      state: "PARTIAL",
      text: null,
      reason: "PDF_TEXT_NOT_EXTRACTED",
      recoveryOptions: uniqueRecovery([
        "UPLOAD_DOCUMENT",
        "ADD_MANUAL_CITATION",
        ...input.classification.recoveryOptions,
      ]),
    };
  }
  if (input.textTruncated === true) {
    return {
      state: "PARTIAL",
      text: input.text,
      reason: "TEXT_TRUNCATED",
      recoveryOptions: uniqueRecovery(["UPLOAD_DOCUMENT", "ADD_MANUAL_CITATION"]),
    };
  }
  return {
    state: input.status,
    text: input.text,
    reason: input.reason ?? null,
    recoveryOptions: input.status === "PARTIAL" ? input.classification.recoveryOptions : [],
  };
}

export class DeterministicResearchSourceAdapter {
  readonly #fixtures: Readonly<Record<string, DeterministicSourceResult>>;

  constructor(fixtures: Readonly<Record<string, DeterministicSourceResult>>) {
    this.#fixtures = fixtures;
  }

  async retrieve(url: URL): Promise<DeterministicSourceResult> {
    const fixture = this.#fixtures[url.toString()];
    if (fixture === undefined) {
      return {
        state: "BLOCKED",
        title: null,
        text: null,
        reason: "DETERMINISTIC_SOURCE_NOT_FOUND",
        recoveryOptions: ["TRY_AGAIN", "ADD_MANUAL_CITATION"],
      };
    }
    return {
      state: fixture.state,
      title: fixture.title,
      text: fixture.text,
      ...(fixture.reason === undefined ? {} : { reason: fixture.reason }),
      ...(fixture.recoveryOptions === undefined
        ? {}
        : { recoveryOptions: [...fixture.recoveryOptions] }),
    };
  }
}

function classifyGithub(url: URL): ResearchSourceClassification {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 2) return githubClassification("REPOSITORY_METADATA");
  if (segments.length >= 3 && segments[2] === "tree") {
    return {
      kind: "GITHUB",
      label: "SELECTED_FILE",
      allowed: false,
      recoveryOptions: ["ADD_MANUAL_CITATION"],
    };
  }
  if (segments.length >= 5 && segments[2] === "blob") {
    return githubClassification(labelGithubFile(segments.at(-1) ?? ""));
  }
  return {
    kind: "GITHUB",
    label: "REPOSITORY_METADATA",
    allowed: false,
    recoveryOptions: ["ADD_MANUAL_CITATION"],
  };
}

function labelGithubFile(filename: string): ResearchSourceLabel {
  const normalized = filename.toLowerCase();
  if (/^readme(?:\.|$)/u.test(normalized)) return "README";
  if (/^(?:license|copying|notice)(?:\.|$)/u.test(normalized)) return "LICENSE";
  if (GITHUB_MANIFESTS.has(normalized)) return "MANIFEST";
  return "SELECTED_FILE";
}

function githubClassification(label: ResearchSourceLabel): ResearchSourceClassification {
  return allowedClassification("GITHUB", label, ["ADD_MANUAL_CITATION"]);
}

function allowedClassification(
  kind: ResearchSourceKind,
  label: ResearchSourceLabel,
  recoveryOptions: readonly ResearchSourceRecovery[] = [],
): ResearchSourceClassification {
  return { kind, label, allowed: true, recoveryOptions };
}

function uniqueRecovery(values: readonly ResearchSourceRecovery[]): ResearchSourceRecovery[] {
  return [...new Set(values)];
}
