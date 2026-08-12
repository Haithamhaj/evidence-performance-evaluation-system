"use client";

import { ActionButton, FocusedDialog } from "@evaluation/ui";
import { createElement, useState } from "react";

type SourceType = "text" | "link" | "code" | "file" | "image";

export function CaptureDialog({
  catalog,
  disabled = false,
  locale,
  onSaved,
  save,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  disabled?: boolean;
  locale: "ar" | "en";
  onSaved: () => void;
  save: (
    input: Readonly<{ sourceType: SourceType; text: string; sourceUploadId: string | null }>,
  ) => Promise<void>;
}>) {
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [text, setText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  if (disabled) return null;
  const savePrivate = async () => {
    setError(false);
    try {
      const sourceUploadId = file === null ? null : await stageFile(file);
      await save({ sourceType, text: file === null ? text.trim() : file.name, sourceUploadId });
      setText("");
      setFile(null);
      setReviewing(false);
      onSaved();
    } catch {
      setError(true);
    }
  };
  return createElement(FocusedDialog, {
    closeLabel: catalog["actions.close"],
    title: catalog["capture.title"],
    trigger: createElement(ActionButton, {
      children: catalog["shell.global.capture"],
      variant: "primary",
    }),
    children: (
      <form
        dir={locale === "ar" ? "rtl" : "ltr"}
        onSubmit={(event) => {
          event.preventDefault();
          reviewing ? void savePrivate() : setReviewing(true);
        }}
      >
        <p>{catalog["capture.privateHint"]}</p>
        <label htmlFor="capture-source">{catalog["capture.source"]}</label>
        <select
          id="capture-source"
          onChange={(event) => {
            setSourceType(event.target.value as SourceType);
            setError(false);
          }}
          value={sourceType}
        >
          <option value="text">{catalog["capture.source.text"]}</option>
          <option value="link">{catalog["capture.source.link"]}</option>
          <option value="code">{catalog["capture.source.code"]}</option>
          <option value="file">{catalog["capture.source.file"]}</option>
          <option value="image">{catalog["capture.source.image"]}</option>
        </select>
        {sourceType === "file" || sourceType === "image" ? (
          <>
            <label htmlFor="capture-file">{catalog["capture.file"]}</label>
            <input
              accept={
                sourceType === "image" ? "image/png,image/jpeg,image/webp" : ".md,.txt,.docx,.pdf"
              }
              id="capture-file"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(false);
              }}
              required
              type="file"
            />
          </>
        ) : (
          <>
            <label htmlFor="capture-text">
              {
                catalog[
                  sourceType === "link"
                    ? "capture.link"
                    : sourceType === "code"
                      ? "capture.code"
                      : "capture.note"
                ]
              }
            </label>
            <textarea
              id="capture-text"
              onChange={(event) => {
                setText(event.target.value);
                setError(false);
              }}
              required
              value={text}
            />
          </>
        )}
        {reviewing ? <p>{catalog["capture.reviewHint"]}</p> : null}
        {error ? (
          <p className="formError" role="alert">
            {catalog["capture.recovery"]}
          </p>
        ) : null}
        <button
          className="primaryAction"
          disabled={
            sourceType === "file" || sourceType === "image" ? file === null : text.trim() === ""
          }
          type="submit"
        >
          {reviewing ? catalog["capture.savePrivate"] : catalog["capture.reviewSave"]}
        </button>
      </form>
    ),
  });
}

async function stageFile(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/capture/uploads", { body: form, method: "POST" });
  if (!response.ok) throw new Error("private capture file staging failed");
  const value = await response.json();
  if (typeof value !== "object" || value === null || typeof value.id !== "string")
    throw new Error("private capture file staging failed");
  return value.id;
}
