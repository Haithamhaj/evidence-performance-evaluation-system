import { gzipSync } from "node:zlib";
import { createServer } from "node:http";

import { describe, expect, it } from "vitest";

import { NodeResearchSourceTransport, SourceRetriever } from "./source-retrieval.js";

const GLOBAL_V4 = "93.184.216.34";
const requestedAt = new Date("2026-08-06T10:00:00.000Z");

function body(value: string | Buffer): AsyncIterable<Uint8Array> {
  const bytes = typeof value === "string" ? Buffer.from(value) : value;
  return (async function* chunks() {
    yield bytes;
  })();
}

function response(
  value: string | Buffer,
  options: Readonly<{
    statusCode?: number;
    headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
  }> = {},
): import("./source-retrieval.js").ResearchSourceResponse {
  return {
    statusCode: options.statusCode ?? 200,
    headers: options.headers ?? { "content-type": "text/plain; charset=utf-8" },
    body: body(value),
  };
}

class FakeTransport {
  readonly requests: import("./source-retrieval.js").ResearchSourceRequest[] = [];
  readonly #responses: Array<import("./source-retrieval.js").ResearchSourceResponse | Error>;

  constructor(responses: Array<import("./source-retrieval.js").ResearchSourceResponse | Error>) {
    this.#responses = responses;
  }

  async request(
    input: import("./source-retrieval.js").ResearchSourceRequest,
  ): Promise<import("./source-retrieval.js").ResearchSourceResponse> {
    this.requests.push(input);
    const next = this.#responses.shift();
    if (next instanceof Error) throw next;
    if (next === undefined) throw new Error("No deterministic response configured.");
    return next;
  }
}

function createRetriever(
  options: Readonly<{
    addresses?: readonly import("./source-retrieval.js").ResearchDnsAnswer[];
    transport?: FakeTransport;
  }> = {},
) {
  const transport = options.transport ?? new FakeTransport([response("source")]);
  const addresses = options.addresses ?? [{ address: GLOBAL_V4, family: 4 as const }];
  return {
    transport,
    retriever: new SourceRetriever({
      transport,
      resolve: async () => addresses,
      now: () => requestedAt,
    }),
  };
}

describe("SourceRetriever security policy", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/source.txt",
    "https://employee:secret@example.com/source.txt",
  ])("rejects unsupported or credential-bearing URL %s", async (url) => {
    await expect(createRetriever().retriever.retrieve({ url })).rejects.toMatchObject({
      code: "RESEARCH_SOURCE_BLOCKED",
    });
  });

  it.each([
    "0.0.0.0",
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
  ])("rejects non-global resolved address %s", async (address) => {
    const family = address.includes(":") ? 6 : 4;
    const { retriever } = createRetriever({
      addresses: [{ address, family: family as 4 | 6 }],
    });
    await expect(retriever.retrieve({ url: "https://example.com/source" })).rejects.toMatchObject({
      code: "RESEARCH_SOURCE_BLOCKED",
    });
  });

  it("rejects a hostname when any DNS answer is non-global", async () => {
    const { retriever, transport } = createRetriever({
      addresses: [
        { address: GLOBAL_V4, family: 4 },
        { address: "127.0.0.1", family: 4 },
      ],
    });

    await expect(retriever.retrieve({ url: "https://example.com/source" })).rejects.toMatchObject({
      code: "RESEARCH_SOURCE_BLOCKED",
    });
    expect(transport.requests).toHaveLength(0);
  });

  it("pins the complete validated DNS answer set and sends credential-free headers", async () => {
    process.env.OPENAI_API_KEY = "must-never-leak";
    process.env.GOOGLE_CLIENT_SECRET = "must-never-leak";
    const { retriever, transport } = createRetriever({
      addresses: [
        { address: GLOBAL_V4, family: 4 },
        { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
      ],
    });

    try {
      await retriever.retrieve({ url: "https://example.com/source" });
    } finally {
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_CLIENT_SECRET;
    }

    expect(transport.requests[0]).toMatchObject({
      pinnedAddresses: [
        { address: GLOBAL_V4, family: 4 },
        { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
      ],
      headers: {
        accept: "text/plain, text/markdown, text/html, application/json, application/pdf",
      },
    });
    expect(transport.requests[0]?.headers).not.toHaveProperty("authorization");
    expect(transport.requests[0]?.headers).not.toHaveProperty("cookie");
    expect(JSON.stringify(transport.requests[0]?.headers)).not.toContain("must-never-leak");
  });

  it("revalidates DNS on every redirect and blocks a redirect to a private target", async () => {
    const transport = new FakeTransport([
      response("", { statusCode: 302, headers: { location: "https://internal.test/secret" } }),
    ]);
    const resolved: string[] = [];
    const retriever = new SourceRetriever({
      transport,
      now: () => requestedAt,
      resolve: async (hostname) => {
        resolved.push(hostname);
        return hostname === "internal.test"
          ? [{ address: "10.0.0.8", family: 4 }]
          : [{ address: GLOBAL_V4, family: 4 }];
      },
    });

    await expect(retriever.retrieve({ url: "https://example.com/start" })).rejects.toMatchObject({
      code: "RESEARCH_SOURCE_BLOCKED",
    });
    expect(resolved).toEqual(["example.com", "internal.test"]);
    expect(transport.requests).toHaveLength(1);
  });

  it("retains DOI paper semantics after a safe publisher redirect", async () => {
    const transport = new FakeTransport([
      response("", {
        statusCode: 302,
        headers: { location: "https://publisher.example/article/123" },
      }),
      response("Published abstract"),
    ]);

    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://doi.org/10.1000/example" }),
    ).resolves.toMatchObject({
      sourceKind: "PAPER",
      sourceLabel: "CITATION_PAGE",
      resolvedUrl: "https://publisher.example/article/123",
      text: "Published abstract",
    });
  });

  it("blocks an HTTPS redirect downgrade before resolving the target", async () => {
    const transport = new FakeTransport([
      response("", {
        statusCode: 302,
        headers: { location: "http://example.com/insecure" },
      }),
    ]);

    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com/secure" }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_BLOCKED" });
    expect(transport.requests).toHaveLength(1);
  });

  it("rejects malformed redirect metadata with a stable safe error", async () => {
    const transport = new FakeTransport([
      response("", { statusCode: 302, headers: { location: "http://[::1" } }),
    ]);
    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com/secure" }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_RESPONSE_INVALID" });
  });

  it("follows at most three redirects", async () => {
    const transport = new FakeTransport([
      response("", { statusCode: 302, headers: { location: "/one" } }),
      response("", { statusCode: 302, headers: { location: "/two" } }),
      response("", { statusCode: 302, headers: { location: "/three" } }),
      response("", { statusCode: 302, headers: { location: "/four" } }),
    ]);

    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REDIRECT_LIMIT" });
    expect(transport.requests).toHaveLength(4);
  });

  it("rejects a declared response larger than 2,000,000 bytes before reading it", async () => {
    const transport = new FakeTransport([
      response("small", {
        headers: {
          "content-type": "text/plain",
          "content-length": "2000001",
        },
      }),
    ]);
    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_TOO_LARGE" });
  });

  it("rejects a streamed response larger than 2,000,000 bytes", async () => {
    const transport = new FakeTransport([response(Buffer.alloc(2_000_001, 97))]);
    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_TOO_LARGE" });
  });

  it("rejects an unsupported MIME type", async () => {
    const transport = new FakeTransport([
      response("binary", { headers: { "content-type": "application/octet-stream" } }),
    ]);
    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_MIME_UNSUPPORTED" });
  });

  it("rejects decompressed content that exceeds the byte policy", async () => {
    const compressed = gzipSync(Buffer.alloc(2_000_001, 97));
    const transport = new FakeTransport([
      response(compressed, {
        headers: { "content-type": "text/plain", "content-encoding": "gzip" },
      }),
    ]);
    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_TOO_LARGE" });
  });

  it("reports transport timeout without returning partial content", async () => {
    const timeout = Object.assign(new Error("timed out"), { code: "ETIMEDOUT" });
    const transport = new FakeTransport([timeout]);
    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_TIMEOUT" });
  });

  it("applies the timeout while resolving DNS", async () => {
    const retriever = new SourceRetriever({
      policy: {
        timeoutMs: 5,
        maxBytes: 2_000_000,
        maxTextChars: 120_000,
        maxRedirects: 3,
        allowedMimeTypes: [
          "text/plain",
          "text/markdown",
          "text/html",
          "application/json",
          "application/pdf",
        ],
      },
      resolve: async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return [{ address: GLOBAL_V4, family: 4 }];
      },
      transport: new FakeTransport([response("late")]),
    });

    await expect(retriever.retrieve({ url: "https://example.com" })).rejects.toMatchObject({
      code: "RESEARCH_SOURCE_TIMEOUT",
    });
  });

  it("maps DNS lookup failure to a stable recoverable source error", async () => {
    const retriever = new SourceRetriever({
      resolve: async () => {
        throw Object.assign(new Error("getaddrinfo ENOTFOUND internal detail"), {
          code: "ENOTFOUND",
        });
      },
      transport: new FakeTransport([]),
    });

    await expect(
      retriever.retrieve({ url: "https://missing.example/source" }),
    ).rejects.toMatchObject({
      code: "RESEARCH_SOURCE_UNAVAILABLE",
      messageKey: "errors.research.sourceUnavailable",
    });
  });

  it("applies the timeout while consuming a slow response body", async () => {
    const slowBody = (async function* chunks() {
      yield Buffer.from("first");
      await new Promise((resolve) => setTimeout(resolve, 25));
      yield Buffer.from("second");
    })();
    const transport = new FakeTransport([
      {
        statusCode: 200,
        headers: { "content-type": "text/plain" },
        body: slowBody,
      },
    ]);
    const retriever = new SourceRetriever({
      policy: {
        timeoutMs: 5,
        maxBytes: 2_000_000,
        maxTextChars: 120_000,
        maxRedirects: 3,
        allowedMimeTypes: [
          "text/plain",
          "text/markdown",
          "text/html",
          "application/json",
          "application/pdf",
        ],
      },
      resolve: async () => [{ address: GLOBAL_V4, family: 4 }],
      transport,
    });

    await expect(retriever.retrieve({ url: "https://example.com" })).rejects.toMatchObject({
      code: "RESEARCH_SOURCE_TIMEOUT",
    });
  });

  it("normalizes only visible bounded HTML and never exposes active content", async () => {
    const transport = new FakeTransport([
      response(
        "<html><head><title>Useful guide</title><style>.secret{}</style></head>" +
          "<body><h1>Safe &amp; useful</h1><script>steal()</script><p>Project guide</p></body></html>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      ),
    ]);

    await expect(
      createRetriever({ transport }).retriever.retrieve({ url: "https://example.com/guide" }),
    ).resolves.toMatchObject({
      state: "RETRIEVED",
      title: "Useful guide",
      text: "Useful guide Safe & useful Project guide",
      requestedUrl: "https://example.com/guide",
      resolvedUrl: "https://example.com/guide",
      retrievedAt: requestedAt.toISOString(),
      mimeType: "text/html",
      byteSize: expect.any(Number),
      contentFingerprintSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("returns an accessible PDF as PARTIAL with manual recovery", async () => {
    const transport = new FakeTransport([
      response("%PDF-1.7", { headers: { "content-type": "application/pdf" } }),
    ]);
    await expect(
      createRetriever({ transport }).retriever.retrieve({
        url: "https://papers.example/study.pdf",
      }),
    ).resolves.toMatchObject({
      state: "PARTIAL",
      sourceKind: "PAPER",
      text: null,
      reason: "PDF_TEXT_NOT_EXTRACTED",
      recoveryOptions: ["UPLOAD_DOCUMENT", "ADD_MANUAL_CITATION"],
    });
  });

  it("returns an inaccessible PDF truthfully as BLOCKED", async () => {
    const transport = new FakeTransport([
      response("denied", { statusCode: 403, headers: { "content-type": "text/plain" } }),
    ]);
    await expect(
      createRetriever({ transport }).retriever.retrieve({
        url: "https://papers.example/study.pdf",
      }),
    ).resolves.toMatchObject({
      state: "BLOCKED",
      reason: "HTTP_403",
      recoveryOptions: ["UPLOAD_DOCUMENT", "ADD_MANUAL_CITATION"],
    });
  });
});

describe("NodeResearchSourceTransport", () => {
  it("connects through the pinned lookup result instead of resolving the URL hostname", async () => {
    const received: Array<
      Readonly<{ url: string | undefined; authorization: string | undefined }>
    > = [];
    const server = createServer((request, response) => {
      received.push({ url: request.url, authorization: request.headers.authorization });
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("pinned response");
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = server.address();
      if (address === null || typeof address === "string")
        throw new Error("Test server unavailable.");
      const transport = new NodeResearchSourceTransport();
      const result = await transport.request({
        url: new URL(`http://source.invalid:${String(address.port)}/explicit?page=1`),
        headers: { accept: "text/plain" },
        timeoutMs: 1_000,
        pinnedAddresses: [{ address: "127.0.0.1", family: 4 }],
      });
      const chunks: Buffer[] = [];
      for await (const chunk of result.body) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).toString("utf8")).toBe("pinned response");
      expect(received).toEqual([{ url: "/explicit?page=1", authorization: undefined }]);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    }
  });
});
