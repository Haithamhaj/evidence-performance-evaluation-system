// Babel's project ESLint parser removes type usage before the base unused-import rule runs.
// eslint-disable-next-line no-unused-vars
import type { BrowserContext } from "@playwright/test";

import { sealAuthCookie } from "../../../apps/web/src/auth/oidc.js";

export const projectId = "11111111-1111-4111-8111-111111111111";
export const workstreamId = "22222222-2222-4222-8222-222222222222";
export const historicalWorkstreamId = "12121212-1212-4212-8212-121212121212";
export const sourceHash = "a".repeat(64);
export const managerAccessToken = "e2e-manager-access-token";
export const otherEmployeeAccessToken = "e2e-other-employee-access-token";

const sessionSecret = "e2e-session-secret-with-at-least-32-characters";

export async function installWorkspaceSession(
  context: BrowserContext,
  accessToken = "e2e-access-token",
): Promise<void> {
  const value = sealAuthCookie(
    {
      kind: "session",
      expiresAt: Date.now() + 60 * 60_000,
      accessToken,
    },
    sessionSecret,
  );
  await context.addCookies([
    {
      name: "evaluation_session",
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}
