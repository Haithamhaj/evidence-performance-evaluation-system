import { afterEach, describe, expect, it, vi } from "vitest";

import { OIDC_SESSION_COOKIE, OIDC_TRANSACTION_COOKIE } from "../../../../auth/oidc.js";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === OIDC_SESSION_COOKIE ? { value: "existing-encrypted-session" } : undefined,
  })),
}));

import { GET } from "./route.js";

afterEach(() => vi.unstubAllEnvs());

describe("OIDC callback cookie finalization", () => {
  it("clears only the transaction cookie when configuration fails", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("OIDC_ISSUER", "");

    const response = await GET(new Request("http://localhost:3000/api/auth/callback"));

    expect(response.status).toBe(500);
    expect(response.cookies.get(OIDC_TRANSACTION_COOKIE)).toMatchObject({ value: "" });
    expect(response.cookies.get(OIDC_SESSION_COOKIE)).toBeUndefined();
  });
});
