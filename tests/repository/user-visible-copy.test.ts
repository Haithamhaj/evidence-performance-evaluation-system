import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { findHardcodedUserVisibleCopy } from "../../scripts/check-user-visible-copy.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function makeFeatureFile(source: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "copy-check-"));
  temporaryDirectories.push(directory);
  const featureDirectory = path.join(directory, "apps/web/src/app");
  await mkdir(featureDirectory, { recursive: true });
  await writeFile(path.join(featureDirectory, "page.tsx"), source);
  return directory;
}

describe("user-visible copy checker", () => {
  it("rejects hardcoded English JSX text in feature source", async () => {
    const root = await makeFeatureFile(
      "export default function Page() { return <h1>Hardcoded heading</h1>; }",
    );

    await expect(findHardcodedUserVisibleCopy(root)).resolves.toEqual([
      expect.objectContaining({ text: "Hardcoded heading" }),
    ]);
  });

  it("rejects hardcoded accessible labels in feature source", async () => {
    const root = await makeFeatureFile(
      'export default function Page() { return <button aria-label="Open menu" />; }',
    );

    await expect(findHardcodedUserVisibleCopy(root)).resolves.toEqual([
      expect.objectContaining({ text: "Open menu" }),
    ]);
  });

  it("rejects hardcoded English text inside a JSX expression", async () => {
    const root = await makeFeatureFile(
      'export default function Page() { return <h1>{"Hardcoded expression"}</h1>; }',
    );

    await expect(findHardcodedUserVisibleCopy(root)).resolves.toEqual([
      expect.objectContaining({ text: "Hardcoded expression" }),
    ]);
  });

  it("rejects a no-expression template literal rendered in JSX", async () => {
    const root = await makeFeatureFile(
      "export default function Page() { return <h1>{`Hardcoded template`}</h1>; }",
    );

    await expect(findHardcodedUserVisibleCopy(root)).resolves.toEqual([
      expect.objectContaining({ text: "Hardcoded template" }),
    ]);
  });

  it("rejects static local const copy rendered in JSX", async () => {
    const root = await makeFeatureFile(
      'export default function Page() { const label = "Hardcoded local"; return <h1>{label}</h1>; }',
    );

    await expect(findHardcodedUserVisibleCopy(root)).resolves.toEqual([
      expect.objectContaining({ text: "Hardcoded local" }),
    ]);
  });

  it("rejects literal and static local copy passed to createElement", async () => {
    const root = await makeFeatureFile(
      [
        'import React, { createElement } from "react";',
        "export default function Page() {",
        '  const description = "Hardcoded description";',
        '  return React.createElement("section", { "aria-description": description },',
        '    createElement("h1", null, "Hardcoded element"));',
        "}",
      ].join("\n"),
    );

    await expect(findHardcodedUserVisibleCopy(root)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "Hardcoded description" }),
        expect.objectContaining({ text: "Hardcoded element" }),
      ]),
    );
  });

  it("rejects additional user-visible ARIA attributes without flagging technical attributes", async () => {
    const root = await makeFeatureFile(
      [
        "export default function Page() {",
        '  return <input aria-valuetext="Current score" className="technical-class" id="field-id" />;',
        "}",
      ].join("\n"),
    );

    await expect(findHardcodedUserVisibleCopy(root)).resolves.toEqual([
      expect.objectContaining({ text: "Current score" }),
    ]);
  });

  it("does not flag imported catalog values or non-feature source", async () => {
    const root = await makeFeatureFile(
      "export default function Page({ catalog }) { return <h1>{catalog['shell.title']}</h1>; }",
    );

    await expect(findHardcodedUserVisibleCopy(root)).resolves.toEqual([]);
  });
});
