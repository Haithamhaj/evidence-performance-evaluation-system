import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { inspectFile } from "./file-inspection.js";

const directories: string[] = [];
const policy = {
  maxBytesByClass: { text: 1_000, office: 5_000, image: 5_000, audio: 5_000 },
  maxArchiveEntries: 10,
  maxArchiveUncompressedBytes: 1_000,
  maxArchiveCompressionRatio: 20,
  signedUrlTtlSeconds: 60,
} as const;

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function fixture(filename: string, bytes: Uint8Array): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "document-inspection-"));
  directories.push(directory);
  const target = path.join(directory, filename);
  await writeFile(target, bytes);
  return target;
}

describe("file inspection", () => {
  it("accepts a matching PDF and rejects extension/MIME/magic spoofing", async () => {
    const pdf = await fixture("report.pdf", Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"));
    await expect(
      inspectFile({ path: pdf, filename: "report.pdf", declaredMime: "application/pdf", policy }),
    ).resolves.toMatchObject({ detectedType: "pdf", detectedMime: "application/pdf" });
    const jpeg = await fixture(
      "fake.pdf",
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0]),
    );
    await expect(
      inspectFile({ path: jpeg, filename: "fake.pdf", declaredMime: "application/pdf", policy }),
    ).rejects.toMatchObject({ code: "UPLOAD_TYPE_REJECTED" });
  });

  it("accepts a DOCX only when required entries are streamed and verified", async () => {
    const docx = zip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types></Types>") },
      { name: "word/document.xml", data: Buffer.from("<document>safe</document>") },
    ]);
    const target = await fixture("architecture.docx", docx);
    await expect(
      inspectFile({
        path: target,
        filename: "architecture.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        policy,
      }),
    ).resolves.toMatchObject({ detectedType: "docx" });
  });

  it.each([
    ["traversal", [{ name: "../escape.xml", data: Buffer.from("bad") }]],
    ["absolute", [{ name: "/escape.xml", data: Buffer.from("bad") }]],
    [
      "duplicate",
      [
        { name: "word/document.xml", data: Buffer.from("one") },
        { name: "word/document.xml", data: Buffer.from("two") },
      ],
    ],
  ])("rejects unsafe DOCX %s entries", async (_case, entries) => {
    const target = await fixture("unsafe.docx", zip(entries));
    await expect(
      inspectFile({
        path: target,
        filename: "unsafe.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        policy,
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_SAFETY_REJECTED" });
  });

  it("rejects actual decompressed bytes and ratios beyond policy", async () => {
    const expanded = Buffer.alloc(1_500, 65);
    const target = await fixture(
      "bomb.docx",
      zip([
        { name: "[Content_Types].xml", data: Buffer.from("<Types></Types>") },
        { name: "word/document.xml", data: expanded },
      ]),
    );
    await expect(
      inspectFile({
        path: target,
        filename: "bomb.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        policy,
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_SAFETY_REJECTED" });
  });

  it("rejects forged central-directory size metadata", async () => {
    const forged = zip(
      [
        { name: "[Content_Types].xml", data: Buffer.from("<Types></Types>") },
        { name: "word/document.xml", data: Buffer.from("<document />") },
      ],
      true,
    );
    const target = await fixture("forged.docx", forged);
    await expect(
      inspectFile({
        path: target,
        filename: "forged.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        policy,
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_SAFETY_REJECTED" });
  });

  it("rejects a local filename that differs from the central directory", async () => {
    const mismatched = zip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types></Types>") },
      { name: "word/document.xml", data: Buffer.from("<document />") },
    ]);
    mismatched[30] = "X".charCodeAt(0);
    const target = await fixture("mismatched-name.docx", mismatched);

    await expect(
      inspectFile({
        path: target,
        filename: "mismatched-name.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        policy,
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_SAFETY_REJECTED" });
  });

  it.each([
    ["flags", 6, 1],
    ["compression method", 8, 0],
    ["CRC-32", 14, 1],
    ["compressed size", 18, 1],
    ["uncompressed size", 22, 1],
  ])("rejects mismatched local %s", async (_field, offset, value) => {
    const mismatched = zip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types></Types>") },
      { name: "word/document.xml", data: Buffer.from("<document />") },
    ]);
    if (offset === 6 || offset === 8) mismatched.writeUInt16LE(value, offset);
    else mismatched.writeUInt32LE(value, offset);
    const target = await fixture("mismatched-field.docx", mismatched);

    await expect(
      inspectFile({
        path: target,
        filename: "mismatched-field.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        policy,
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_SAFETY_REJECTED" });
  });

  it("rejects unexpected bytes between local entries and the central directory", async () => {
    const archive = zip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types></Types>") },
      { name: "word/document.xml", data: Buffer.from("<document />") },
    ]);
    const withGap = insertBeforeCentralDirectory(archive, Buffer.from([0]));
    const target = await fixture("unexpected-structure.docx", withGap);

    await expect(
      inspectFile({
        path: target,
        filename: "unexpected-structure.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        policy,
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_SAFETY_REJECTED" });
  });

  it("accepts entries that use a matching data descriptor", async () => {
    const target = await fixture(
      "descriptor.docx",
      zip([
        {
          name: "[Content_Types].xml",
          data: Buffer.from("<Types></Types>"),
          dataDescriptor: true,
        },
        {
          name: "word/document.xml",
          data: Buffer.from("<document />"),
          dataDescriptor: true,
        },
      ]),
    );

    await expect(
      inspectFile({
        path: target,
        filename: "descriptor.docx",
        declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        policy,
      }),
    ).resolves.toMatchObject({ detectedType: "docx" });
  });
});

type ZipEntry = Readonly<{ name: string; data: Buffer; dataDescriptor?: boolean }>;

function zip(entries: readonly ZipEntry[], forgeFirstSize = false): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [index, entry] of entries.entries()) {
    const name = Buffer.from(entry.name);
    const compressed = deflateRawSync(entry.data);
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.dataDescriptor === true ? 8 : 0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(entry.dataDescriptor === true ? 0 : checksum, 14);
    local.writeUInt32LE(entry.dataDescriptor === true ? 0 : compressed.length, 18);
    local.writeUInt32LE(entry.dataDescriptor === true ? 0 : entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const descriptor = Buffer.alloc(entry.dataDescriptor === true ? 16 : 0);
    if (entry.dataDescriptor === true) {
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(checksum, 4);
      descriptor.writeUInt32LE(compressed.length, 8);
      descriptor.writeUInt32LE(entry.data.length, 12);
    }
    locals.push(local, name, compressed, descriptor);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(entry.dataDescriptor === true ? 8 : 0, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(
      forgeFirstSize && index === 0 ? entry.data.length + 1 : entry.data.length,
      24,
    );
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += local.length + name.length + compressed.length + descriptor.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

function insertBeforeCentralDirectory(archive: Buffer, bytes: Buffer): Buffer {
  const endOffset = archive.length - 22;
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  const changed = Buffer.concat([
    archive.subarray(0, centralOffset),
    bytes,
    archive.subarray(centralOffset),
  ]);
  changed.writeUInt32LE(centralOffset + bytes.length, endOffset + bytes.length + 16);
  return changed;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
