import { Controller, Get, Req, UseGuards } from "@nestjs/common";

import { AuthGuard } from "./auth.guard.js";

interface PrincipalRequest {
  readonly principal: import("@evaluation/auth").AuthenticatedPrincipal;
}

export class MeController {
  me(request: PrincipalRequest): import("@evaluation/auth").AuthenticatedPrincipal {
    return request.principal;
  }
}

Req()(MeController.prototype, "me", 0);
Controller("api/v1")(MeController);
UseGuards(AuthGuard)(MeController);
Get("me")(
  MeController.prototype,
  "me",
  Object.getOwnPropertyDescriptor(MeController.prototype, "me")!,
);
