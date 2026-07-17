import {
  AppError,
  PROJECT_PROTECTED_SECTION_KEYS,
  WORKSTREAM_REQUIRED_SECTION_KEYS,
} from "@evaluation/contracts";

export function assertActivatableTemplate(
  kind: import("@evaluation/contracts").DocumentKind,
  sections: readonly import("@evaluation/contracts").DocumentTemplateSectionInput[],
): void {
  const keys = new Set<string>();
  const positions = new Set<number>();
  for (const section of sections) {
    if (keys.has(section.key) || positions.has(section.position)) throw invalidTemplate();
    keys.add(section.key);
    positions.add(section.position);
  }

  if (kind === "project") {
    for (const key of PROJECT_PROTECTED_SECTION_KEYS) {
      const section = sections.find((candidate) => candidate.key === key);
      if (section === undefined || !section.required || !section.protected) {
        throw invalidTemplate();
      }
    }
    return;
  }

  for (const key of WORKSTREAM_REQUIRED_SECTION_KEYS) {
    const section = sections.find((candidate) => candidate.key === key);
    if (section === undefined || !section.required) throw invalidTemplate();
  }
}

function invalidTemplate(): AppError {
  return new AppError("DOCUMENT_TEMPLATE_INVALID", "errors.documents.templateInvalid", 400);
}
