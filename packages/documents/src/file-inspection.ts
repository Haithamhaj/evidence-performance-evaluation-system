import { createReadStream } from "node:fs";
import { open as openFile, stat } from "node:fs/promises";
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
    await inspectDocxArchive(input.path, input.policy);
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

export async function inspectDocxArchive(
  path: string,
  policy: InspectionInput["policy"],
): Promise<void> {
  let file: OpenFile | undefined;
  try {
    file = await openFile(path, "r");
    const archiveFile = file;
    const zip = await openZip(path);
    const centralDirectoryStart = zip.readEntryCursor as unknown as number;
    await new Promise<void>((resolve, reject) => {
      const names = new Set<string>();
      const localRanges: ArchiveRange[] = [];
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
        void (async () => {
          if (settled) return;
          if (!names.has("[Content_Types].xml") || !names.has("word/document.xml"))
            throw safetyRejected();
          await assertArchiveLayout({
            file: archiveFile,
            fileSize: zip.fileSize,
            entryCount: entries,
            centralDirectoryStart,
            centralDirectoryEnd: zip.readEntryCursor as unknown as number,
            localRanges,
          });
          settled = true;
          resolve();
        })().catch(fail);
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
          localRanges.push(
            ...(await inspectLocalRecord(archiveFile, zip, entry, centralDirectoryStart)),
          );
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
  } finally {
    await file?.close().catch(() => undefined);
  }
}

export async function extractValidatedDocxText(
  path: string,
  policy: InspectionInput["policy"],
): Promise<string> {
  await inspectDocxArchive(path, policy);
  const zip = await openZip(path);
  try {
    const xml = await new Promise<Buffer>((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(error);
      };
      zip.on("error", fail);
      zip.on("end", () => fail(safetyRejected()));
      zip.on("entry", (entry: yauzl.Entry) => {
        void (async () => {
          if (entry.fileName !== "word/document.xml") {
            zip.readEntry();
            return;
          }
          const chunks: Buffer[] = [];
          let total = 0;
          for await (const raw of await openEntry(zip, entry)) {
            const chunk = raw as Buffer;
            total += chunk.length;
            if (total > policy.maxArchiveUncompressedBytes) throw safetyRejected();
            chunks.push(chunk);
          }
          settled = true;
          zip.close();
          resolve(Buffer.concat(chunks, total));
        })().catch(fail);
      });
      zip.readEntry();
    });
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(xml);
    return decoded
      .replace(/<w:tab\b[^>]*\/>/gu, "\t")
      .replace(/<w:(?:br|cr)\b[^>]*\/>/gu, "\n")
      .replace(/<\/w:p>/gu, "\n")
      .replace(/<[^>]+>/gu, "")
      .replace(/&lt;/gu, "<")
      .replace(/&gt;/gu, ">")
      .replace(/&amp;/gu, "&")
      .replace(/&quot;/gu, '"')
      .replace(/&apos;/gu, "'")
      .trim();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw safetyRejected();
  }
}

type ArchiveRange = Readonly<{ start: number; end: number }>;
type OpenFile = Awaited<ReturnType<typeof openFile>>;

async function inspectLocalRecord(
  file: OpenFile,
  zip: yauzl.ZipFile,
  entry: yauzl.Entry,
  centralDirectoryStart: number,
): Promise<ArchiveRange[]> {
  const local = await readLocalHeader(zip, entry);
  if (
    !local.fileName.equals(entry.fileNameRaw) ||
    local.generalPurposeBitFlag !== entry.generalPurposeBitFlag ||
    local.compressionMethod !== entry.compressionMethod
  )
    throw safetyRejected();

  const usesDescriptor = (entry.generalPurposeBitFlag & 8) !== 0;
  if (usesDescriptor) {
    if (local.crc32 !== 0 || local.compressedSize !== 0 || local.uncompressedSize !== 0)
      throw safetyRejected();
  } else if (
    local.crc32 !== entry.crc32 ||
    local.compressedSize !== entry.compressedSize ||
    local.uncompressedSize !== entry.uncompressedSize
  ) {
    throw safetyRejected();
  }

  const fileDataEnd = local.fileDataStart + entry.compressedSize;
  if (
    !Number.isSafeInteger(entry.relativeOffsetOfLocalHeader) ||
    !Number.isSafeInteger(local.fileDataStart) ||
    !Number.isSafeInteger(fileDataEnd) ||
    entry.relativeOffsetOfLocalHeader < 0 ||
    local.fileDataStart <= entry.relativeOffsetOfLocalHeader ||
    fileDataEnd < local.fileDataStart ||
    fileDataEnd > centralDirectoryStart
  )
    throw safetyRejected();

  const ranges: ArchiveRange[] = [
    { start: entry.relativeOffsetOfLocalHeader, end: local.fileDataStart },
  ];
  if (fileDataEnd > local.fileDataStart)
    ranges.push({ start: local.fileDataStart, end: fileDataEnd });
  if (usesDescriptor)
    ranges.push(await inspectDataDescriptor(file, fileDataEnd, entry, centralDirectoryStart));
  return ranges;
}

function readLocalHeader(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<yauzl.LocalFileHeader> {
  return new Promise((resolve, reject) => {
    zip.readLocalFileHeader(entry, (error, header) => {
      if (error) reject(error);
      else resolve(header);
    });
  });
}

async function inspectDataDescriptor(
  file: OpenFile,
  start: number,
  entry: yauzl.Entry,
  centralDirectoryStart: number,
): Promise<ArchiveRange> {
  const prefix = await readExactly(file, 4, start, centralDirectoryStart);
  const hasSignature = prefix.readUInt32LE(0) === 0x08074b50;
  const remainderLength = hasSignature ? 12 : 8;
  const remainder = await readExactly(file, remainderLength, start + 4, centralDirectoryStart);
  const crc = hasSignature ? remainder.readUInt32LE(0) : prefix.readUInt32LE(0);
  const compressedSize = remainder.readUInt32LE(hasSignature ? 4 : 0);
  const uncompressedSize = remainder.readUInt32LE(hasSignature ? 8 : 4);
  if (
    crc !== entry.crc32 ||
    compressedSize !== entry.compressedSize ||
    uncompressedSize !== entry.uncompressedSize
  )
    throw safetyRejected();
  return { start, end: start + 4 + remainderLength };
}

async function assertArchiveLayout(input: {
  file: OpenFile;
  fileSize: number;
  entryCount: number;
  centralDirectoryStart: number;
  centralDirectoryEnd: number;
  localRanges: readonly ArchiveRange[];
}): Promise<void> {
  const ranges = [...input.localRanges].sort((left, right) => left.start - right.start);
  let cursor = 0;
  for (const range of ranges) {
    if (
      !Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start !== cursor ||
      range.end <= range.start
    )
      throw safetyRejected();
    cursor = range.end;
  }
  if (
    cursor !== input.centralDirectoryStart ||
    !Number.isSafeInteger(input.centralDirectoryEnd) ||
    input.centralDirectoryEnd < input.centralDirectoryStart ||
    input.fileSize !== input.centralDirectoryEnd + 22
  )
    throw safetyRejected();

  const end = await readExactly(input.file, 22, input.centralDirectoryEnd, input.fileSize);
  if (
    end.readUInt32LE(0) !== 0x06054b50 ||
    end.readUInt16LE(4) !== 0 ||
    end.readUInt16LE(6) !== 0 ||
    end.readUInt16LE(8) !== input.entryCount ||
    end.readUInt16LE(10) !== input.entryCount ||
    end.readUInt32LE(12) !== input.centralDirectoryEnd - input.centralDirectoryStart ||
    end.readUInt32LE(16) !== input.centralDirectoryStart ||
    end.readUInt16LE(20) !== 0
  )
    throw safetyRejected();
}

async function readExactly(
  file: OpenFile,
  length: number,
  position: number,
  upperBound: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(position) || position < 0 || position + length > upperBound)
    throw safetyRejected();
  const bytes = Buffer.alloc(length);
  const { bytesRead } = await file.read(bytes, 0, length, position);
  if (bytesRead !== length) throw safetyRejected();
  return bytes;
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
