import { describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../auth/auth.guard.js";
import { ProjectsAuthenticationGuard } from "./projects-authentication.guard.js";

describe("ProjectsAuthenticationGuard", () => {
  it("delegates authentication to the AuthModule-owned guard", async () => {
    const context = {} as import("@nestjs/common").ExecutionContext;
    const canActivate = vi.fn().mockResolvedValue(true);
    const guard = new ProjectsAuthenticationGuard({ canActivate } as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(canActivate).toHaveBeenCalledWith(context);
    expect(Reflect.getMetadata("self:paramtypes", ProjectsAuthenticationGuard)).toContainEqual({
      index: 0,
      param: AuthGuard,
    });
  });
});
