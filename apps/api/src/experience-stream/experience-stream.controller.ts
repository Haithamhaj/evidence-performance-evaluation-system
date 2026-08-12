/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { Controller, Headers, Inject, Query, Req, Sse, UseGuards } from "@nestjs/common";
import { concatMap, from, mergeMap, timer, type Observable } from "rxjs";
import { z } from "zod";

import { ExperienceEventRuntime } from "../operations/experience-event-runtime.js";
import { OperationsPolicyGuard } from "../operations/operations-policy.guard.js";
import { ExperienceStreamSession } from "./experience-stream-session.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
}>;

type StreamMessage = Readonly<{
  id: string;
  type: "experience.changed";
  data: Readonly<{ cursor: string }>;
}>;

const CursorSchema = z.string().regex(/^[1-9]\d*$/u);
const QuerySchema = z.object({ afterCursor: CursorSchema.optional() }).passthrough();

export class ExperienceStreamController {
  private readonly runtime: ExperienceEventRuntime;

  constructor(runtime: ExperienceEventRuntime) {
    this.runtime = runtime;
  }

  stream(request: Request, query: unknown, lastEventId?: string): Observable<StreamMessage> {
    assertActive(request);
    const parsed = QuerySchema.parse(query);
    const headerCursor =
      lastEventId === undefined || lastEventId === "" ? null : CursorSchema.parse(lastEventId);
    const session = new ExperienceStreamSession(
      this.runtime,
      request.principal.userId,
      headerCursor ?? parsed.afterCursor ?? null,
    );

    return timer(0, 1_500).pipe(
      concatMap(() => from(session.read())),
      mergeMap((notifications) =>
        from(
          notifications.map((notification) => ({
            id: notification.cursor,
            type: notification.event,
            data: notification.data,
          })),
        ),
      ),
    );
  }
}

function assertActive(request: Request) {
  if (!request.principal.active) {
    throw new AppError("AUTH_INACTIVE_USER", "errors.auth.inactiveUser", 403);
  }
}

Controller("api/v1/experience-stream")(ExperienceStreamController);
UseGuards(OperationsPolicyGuard)(ExperienceStreamController);
Inject(ExperienceEventRuntime)(ExperienceStreamController, undefined, 0);

const stream = Object.getOwnPropertyDescriptor(ExperienceStreamController.prototype, "stream")!;
Req()(ExperienceStreamController.prototype, "stream", 0);
Query()(ExperienceStreamController.prototype, "stream", 1);
Headers("last-event-id")(ExperienceStreamController.prototype, "stream", 2);
Sse()(ExperienceStreamController.prototype, "stream", stream);
