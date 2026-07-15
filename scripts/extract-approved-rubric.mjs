import console from "node:console";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SECTION_IDS = new Map([
  ["Professional Performance and Workplace Behavior", "PPB"],
  ["AI Research, Learning, and Development", "ARL"],
  ["Engineering, Execution, and Documentation", "EED"],
  ["Project Contribution", "PROJECT-CONTRIBUTION"],
]);
const EXPECTED_SECTION_WEIGHTS = new Map([
  ["PPB", 20],
  ["ARL", 25],
  ["EED", 30],
  ["PROJECT-CONTRIBUTION", 25],
]);
const EXPECTED_EMPLOYEE_IDS = [
  "PPB-01",
  "PPB-02",
  "PPB-03",
  "PPB-04",
  "ARL-01",
  "ARL-02",
  "ARL-03",
  "ARL-04",
  "EED-01",
  "EED-02",
  "EED-03",
  "EED-04",
];

function fail(message) {
  throw new Error(`Approved rubric extraction failed: ${message}`);
}

function headingBody(block, heading) {
  const marker = `### ${heading}\n\n`;
  const start = block.indexOf(marker);
  if (start < 0) return undefined;
  const bodyStart = start + marker.length;
  const next = block.indexOf("\n### ", bodyStart);
  return block.slice(bodyStart, next < 0 ? block.length : next).trim();
}

function paragraph(block, heading) {
  const body = headingBody(block, heading);
  return body?.split("\n\n", 1)[0]?.trim();
}

function tableAnchors(block) {
  const body = headingBody(block, "Behavioral Anchors");
  if (!body) fail("criterion is missing Behavioral Anchors");
  const anchors = [...body.matchAll(/^\| ([1-5]) \| (.+) \|$/gmu)].map((match) => ({
    rating: Number(match[1]),
    text: match[2].trim(),
  }));
  if (anchors.length !== 5) fail(`expected five anchors, found ${anchors.length}`);
  return anchors;
}

function bullets(block, heading) {
  const body = headingBody(block, heading);
  if (!body) return [];
  return [...body.matchAll(/^- (.+)$/gmu)].map((match) => match[1].trim());
}

function numberedHeadingBody(block, heading) {
  const marker = `## ${heading}\n\n`;
  const start = block.indexOf(marker);
  if (start < 0) return undefined;
  const bodyStart = start + marker.length;
  const next = block.indexOf("\n## ", bodyStart);
  return block.slice(bodyStart, next < 0 ? block.length : next).trim();
}

function numberedParagraph(block, heading) {
  return numberedHeadingBody(block, heading)?.split("\n\n", 1)[0]?.trim();
}

function numberedBullets(block, heading) {
  const body = numberedHeadingBody(block, heading);
  return body ? [...body.matchAll(/^- (.+)$/gmu)].map((match) => match[1].trim()) : [];
}

function valueFromBoldLine(block, label) {
  const match = new RegExp(`^\\*\\*${label}:\\*\\* (.+)$`, "mu").exec(block);
  return match?.[1]?.trim();
}

function numberFromPercent(value, label) {
  const match = /^(\d+)%$/u.exec(value ?? "");
  if (!match) fail(`invalid ${label}`);
  return Number(match[1]);
}

function blocksBetween(source, startPattern, endPattern) {
  const start = source.search(startPattern);
  if (start < 0) fail(`missing ${startPattern}`);
  const tail = source.slice(start);
  const relativeEnd = tail.search(endPattern);
  return relativeEnd < 0 ? tail : tail.slice(0, relativeEnd);
}

function extractSections(source) {
  const architecture = blocksBetween(source, /^# 5\. Evaluation Architecture$/mu, /^# 6\./mu);
  const rows = [...architecture.matchAll(/^\| ([^|]+?) \| (\d+)% \|/gmu)];
  const sections = rows.map((match) => {
    const title = match[1].trim();
    const id = SECTION_IDS.get(title);
    if (!id) fail(`unknown section ${title}`);
    return { id, title, weight: Number(match[2]) };
  });
  if (sections.length !== 4) fail(`expected four sections, found ${sections.length}`);
  if (sections.reduce((total, section) => total + section.weight, 0) !== 100) {
    fail("section weights do not total 100");
  }
  for (const section of sections) {
    if (section.weight !== EXPECTED_SECTION_WEIGHTS.get(section.id)) {
      fail(`approved weight changed for section ${section.id}`);
    }
  }
  return sections;
}

function extractEmployeeCriteria(source) {
  const records = blocksBetween(source, /^# 7\. Criterion Records$/mu, /^# 8\./mu);
  const headings = [...records.matchAll(/^## ((?:PPB|ARL|EED)-\d{2}) — (.+)$/gmu)];
  const criteria = headings.map((heading, index) => {
    const start = heading.index;
    const end = headings[index + 1]?.index ?? records.length;
    const block = records
      .slice(start, end)
      .replace(/\n---\s*$/u, "")
      .trim();
    const id = heading[1];
    const title = heading[2].trim();
    const sectionTitle = valueFromBoldLine(block, "Section");
    const sectionId = SECTION_IDS.get(sectionTitle ?? "");
    if (!sectionId || sectionId === "PROJECT-CONTRIBUTION") {
      fail(`invalid section for ${id}`);
    }
    return {
      id,
      title,
      sectionId,
      internalWeight: numberFromPercent(
        valueFromBoldLine(block, "Internal weight"),
        `${id} weight`,
      ),
      assessmentBasis: valueFromBoldLine(block, "Assessment basis"),
      definition: paragraph(block, "Definition"),
      whyItMatters: paragraph(block, "Why It Matters"),
      included: paragraph(block, "Included"),
      excluded: paragraph(block, "Excluded"),
      anchors: tableAnchors(block),
      evidenceGuidance: paragraph(block, "Evidence and Observation Guidance"),
      examples: bullets(block, "Examples and Anti-Example"),
    };
  });
  if (criteria.length !== 12) fail(`expected 12 employee criteria, found ${criteria.length}`);
  if (criteria.map(({ id }) => id).join(",") !== EXPECTED_EMPLOYEE_IDS.join(",")) {
    fail("employee criterion stable IDs or order changed");
  }
  if (criteria.flatMap(({ anchors }) => anchors).length !== 60)
    fail("employee anchor count mismatch");
  for (const sectionId of ["PPB", "ARL", "EED"]) {
    const internalTotal = criteria
      .filter((criterion) => criterion.sectionId === sectionId)
      .reduce((total, criterion) => total + criterion.internalWeight, 0);
    if (internalTotal !== 100) fail(`${sectionId} internal weights do not total 100`);
  }
  return criteria;
}

function extractProjectContribution(source) {
  const block = blocksBetween(source, /^# 8\. Project Contribution — 25%$/mu, /^# 9\./mu);
  const anchorsBody = blocksBetween(
    block,
    /^## 8\.3 Project Contribution Anchors$/mu,
    /^## 8\.4/mu,
  );
  const anchors = [...anchorsBody.matchAll(/^\| ([1-5]) \| (.+) \|$/gmu)].map((match) => ({
    rating: Number(match[1]),
    text: match[2].trim(),
  }));
  if (anchors.length !== 5) fail("Project Contribution anchor count mismatch");
  return {
    id: "PROJECT-CONTRIBUTION",
    title: "Project Contribution",
    sectionId: "PROJECT-CONTRIBUTION",
    sectionWeight: 25,
    purpose: numberedParagraph(block, "8.1 Purpose"),
    anchors,
    prohibitedInputs: numberedBullets(block, "8.2 No Automatic Average"),
    requiredContextReview: numberedBullets(block, "8.4 Required Context Review"),
    examples: numberedBullets(block, "8.5 Examples"),
  };
}

function extractManagerCriteria(source) {
  const records = blocksBetween(source, /^# 12\. Upward Manager Evaluation$/mu, /^## 12\.2/mu);
  const headings = [...records.matchAll(/^## (MGR-\d{2}) — (.+)$/gmu)];
  const criteria = headings.map((heading, index) => {
    const start = heading.index;
    const end = headings[index + 1]?.index ?? records.length;
    const block = records
      .slice(start, end)
      .replace(/\n---\s*$/u, "")
      .trim();
    return {
      id: heading[1],
      title: heading[2].trim(),
      definition: paragraph(block, "Definition"),
      anchors: tableAnchors(block),
      commentPrompt: paragraph(block, "Comment Prompt"),
    };
  });
  if (criteria.length !== 5) fail(`expected five manager criteria, found ${criteria.length}`);
  if (criteria.map(({ id }) => id).join(",") !== "MGR-01,MGR-02,MGR-03,MGR-04,MGR-05") {
    fail("manager criterion stable IDs or order changed");
  }
  if (criteria.flatMap(({ anchors }) => anchors).length !== 25)
    fail("manager anchor count mismatch");
  return criteria;
}

function extractBiasGuidance(source) {
  const section = blocksBetween(source, /^# 13\. Bias and Fairness Controls$/mu, /^# 14\./mu);
  const rows = [...section.matchAll(/^\| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$/gmu)]
    .slice(1)
    .map((match) => `${match[1].trim()} | ${match[2].trim()} | ${match[3].trim()}`);
  if (rows.length === 0) fail("bias guidance is missing");
  return rows;
}

export function extractApprovedRubric(source) {
  const employeeCriteria = extractEmployeeCriteria(source);
  const projectContribution = extractProjectContribution(source);
  const managerCriteria = extractManagerCriteria(source);
  return {
    version: "1",
    locale: "en",
    sourceHash: createHash("sha256").update(source).digest("hex"),
    sections: extractSections(source),
    employeeCriteria,
    projectContribution,
    managerCriteria,
    biasGuidance: extractBiasGuidance(source),
  };
}

export async function writeApprovedRubric(sourcePath, destinationPath) {
  const source = await readFile(sourcePath, "utf8");
  const rubric = extractApprovedRubric(source);
  const output = `${JSON.stringify(rubric, null, 2)}\n`;
  let existing;
  try {
    existing = await readFile(destinationPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (existing !== undefined && existing !== output) {
    fail("refusing to overwrite an existing committed Version 1 artifact with different content");
  }
  if (existing === undefined) await writeFile(destinationPath, output, { flag: "wx" });
  return { rubric, changed: existing === undefined };
}

async function main() {
  const [sourceArgument, destinationArgument] = process.argv.slice(2);
  if (!sourceArgument || !destinationArgument) {
    fail("usage: extract-approved-rubric.mjs <source> <destination>");
  }
  const result = await writeApprovedRubric(
    path.resolve(sourceArgument),
    path.resolve(destinationArgument),
  );
  console.log(
    `RUBRIC EXTRACTED: 12/60 employee, 1/5 Project Contribution, 5/25 manager, 100% weight, ${result.rubric.sourceHash}${result.changed ? "" : ", unchanged"}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
