import { afterEach, describe, expect, it, vi } from "vitest";

import { OIDC_TRANSACTION_COOKIE } from "../../../../auth/oidc.js";
import { GET } from "./route.js";

afterEach(() => vi.unstubAllEnvs());

describe("OIDC login origin", () => {
  it("moves a local alias to the configured public origin before setting the transaction cookie", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
    vi.stubEnv("OIDC_AUDIENCE", "evaluation-api");
    vi.stubEnv("OIDC_CLIENT_ID", "evaluation-web");
    vi.stubEnv("OIDC_ISSUER", "http://127.0.0.1:8081/realms/evaluation");
    vi.stubEnv("OIDC_SESSION_SECRET", "local-test-session-secret-with-at-least-32-characters");

    const response = await GET(
      new Request("http://localhost:3000/api/auth/login", {
        headers: { host: "127.0.0.1:3000" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/api/auth/login");
    expect(response.cookies.get(OIDC_TRANSACTION_COOKIE)).toBeUndefined();
  });
});
