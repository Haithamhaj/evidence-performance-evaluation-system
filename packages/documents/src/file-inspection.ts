import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { TextDecoder } from "node:util";

import { AppError } from "@evaluation/contracts";
import { fileTypeFromFile } from "file-type";
import yauzl from "yauzl";

type InspectionInput = Readonly<{
  path: string;
  filename: string;
  declaredMime: string;
  policy: import("./model.js").UploadPolicy;
}>;

export type InspectedFile = Readonly<{
  detectedType: string;
  detectedMime: string;
  mediaClass: import("./model.js").UploadMediaClass;
  byteSize: number;
}>;

const formats = new Map<
  string,
  Readonly<{
    mediaClass: import("./model.js").UploadMediaClass;
    mimes: readonly string[];
    detectedExtensions: readonly string[];
  }>
>([
  ["md", { mediaClass: "text", mimes: ["text/markdown", "text/plain"], detectedExtensions: [] }],
  ["txt", { mediaClass: "text", mimes: ["text/plain"], detectedExtensions: [] }],
  [
    "docx",
    {
      mediaClass: "office",
      mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      detectedExtensions: ["docx", "zip"],
    },
  ],
  ["pdf", { mediaClass: "office", mimes: ["application/pdf"], detectedExtensions: ["pdf"] }],
  ["png", { mediaClass: "image", mimes: ["image/png"], detectedExtensions: ["png"] }],
  ["jpg", { mediaClass: "image", mimes: ["image/jpeg"], detectedExtensions: ["jpg"] }],
  ["jpeg", { mediaClass: "image", mimes: ["image/jpeg"], detectedExtensions: ["jpg"] }],
  ["webp", { mediaClass: "image", mimes: ["image/webp"], detectedExtensions: ["webp"] }],
  [
    "wav",
    { mediaClass: "audio", mimes: ["audio/wav", "audio/x-wav"], detectedExtensions: ["wav"] },
  ],
  ["mp3", { mediaClass: "audio", mimes: ["audio/mpeg"], detectedExtensions: ["mp3"] }],
  [
    "m4a",
    {
      mediaClass: "audio",
      mimes: ["audio/mp4", "audio/x-m4a"],
      detectedExtensions: ["m4a", "mp4"],
    },
  ],
]);

export async function inspectFile(input: InspectionInput): Promise<InspectedFile> {
  const extension = input.filename.toLowerCase().match(/\.([a-z0-9]+)$/u)?.[1];
  const format = extension === undefined ? undefined : formats.get(extension);
  if (format === undefined || !format.mimes.includes(input.declaredMime)) throw typeRejected();
  const file = await stat(input.path);
  if (!file.isFile() || file.size <= 0) throw typeRejected();
  if (file.size > input.policy.maxBytesByClass[format.mediaClass]) throw sizeRejected();

  if (extension === "md" || extension === "txt") {
    await assertUtf8(input.path);
    return {
      detectedType: extension,
      detectedMime: input.declaredMime,
      mediaClass: "text",
      byteSize: file.size,
    };
  }
  if (extension === "docx") {
    await inspectDocx(input.path, input.policy);
    return {
      detectedType: "docx",
      detectedMime: input.declaredMime,
      mediaClass: "office",
      byteSize: file.size,
    };
  }
  const detected = await fileTypeFromFile(input.path);
  if (detected === undefined || !format.detectedExtensions.includes(detected.ext))
    throw typeRejected();
  return {
    detectedType: extension!,
    detectedMime: detected.mime,
    mediaClass: format.mediaClass,
    byteSize: file.size,
  };
}

async function assertUtf8(path: string): Promise<void> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for await (const chunk of createReadStream(path))
      decoder.decode(chunk as Buffer, { stream: true });
    decoder.decode();
  } catch {
    throw typeRejected();
  }
}

async function inspectDocx(path: string, policy: InspectionInput["policy"]): Promise<void> {
  try {
    const zip = await openZip(path);
    await new Promise<void>((resolve, reject) => {
      const names = new Set<string>();
      let entries = 0;
      let actualTotal = 0;
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(error);
      };
      zip.on("error", fail);
      zip.on("end", () => {
        if (settled) return;
        settled = true;
        if (!names.has("[Content_Types].xml") || !names.has("word/document.xml")) {
          reject(safetyRejected());
          return;
        }
        resolve();
      });
      zip.on("entry", (entry: yauzl.Entry) => {
        void (async () => {
          entries += 1;
          if (
            entries > policy.maxArchiveEntries ||
            names.has(entry.fileName) ||
            entry.fileName.startsWith("/") ||
            entry.fileName.includes("..") ||
            entry.fileName.includes("\\") ||
            (entry.generalPurposeBitFlag & 1) !== 0 ||
            ![0, 8].includes(entry.compressionMethod)
          )
            throw safetyRejected();
          names.add(entry.fileName);
          if (entry.fileName.endsWith("/")) {
            zip.readEntry();
            return;
          }
          const stream = await openEntry(zip, entry);
          let actual = 0;
          let crc = 0xffffffff;
          for await (const chunk of stream) {
            const bytes = chunk as Buffer;
            actual += bytes.length;
            actualTotal += bytes.length;
            crc = crc32Update(crc, bytes);
            if (
              actualTotal > policy.maxArchiveUncompressedBytes ||
              (entry.compressedSize > 0 &&
                actual / entry.compressedSize > policy.maxArchiveCompressionRatio)
            )
              throw safetyRejected();
          }
          const checksum = (crc ^ 0xffffffff) >>> 0;
          if (actual !== entry.uncompressedSize || checksum !== entry.crc32) throw safetyRejected();
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw safetyRejected();
  }
}

function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      path,
      { autoClose: true, lazyEntries: true, strictFileNames: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || zip === undefined) reject(error ?? safetyRejected());
        else resolve(zip);
      },
    );
  });
}

function openEntry(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || stream === undefined) reject(error ?? safetyRejected());
      else resolve(stream);
    });
  });
}

function crc32Update(initial: number, bytes: Uint8Array): number {
  let crc = initial;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return crc;
}

function typeRejected() {
  return new AppError("UPLOAD_TYPE_REJECTED", "errors.documents.uploadTypeRejected", 400);
}
function sizeRejected() {
  return new AppError("UPLOAD_SIZE_REJECTED", "errors.documents.uploadSizeRejected", 413);
}
function safetyRejected() {
  return new AppError("UPLOAD_SAFETY_REJECTED", "errors.documents.uploadSafetyRejected", 400);
}
