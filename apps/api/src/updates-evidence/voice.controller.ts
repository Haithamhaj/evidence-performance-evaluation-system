import {
  ConfirmVoiceTranscriptInputSchema,
  ReviseVoiceTranscriptInputSchema,
  StartVoiceUpdateInputSchema,
} from "@evaluation/contracts";
import { VoiceUpdateService } from "@evaluation/updates-evidence";
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { UpdatesEvidencePolicyGuard } from "./updates-evidence-policy.guard.js";

type Request = Readonly<{ principal: import("@evaluation/auth").AuthenticatedPrincipal; correlationId: string }>;

export class VoiceUpdatesController {
  private readonly voice: VoiceUpdateService;
  constructor(voice: VoiceUpdateService) { this.voice = voice; }
  start(request: Request, body: unknown) { return this.voice.start({ actor: actor(request), correlationId: request.correlationId, input: StartVoiceUpdateInputSchema.parse(body) }); }
  revise(request: Request, voiceSessionId: string, body: unknown) { return this.voice.reviseTranscript({ actor: actor(request), voiceSessionId: z.string().uuid().parse(voiceSessionId), input: ReviseVoiceTranscriptInputSchema.parse(body) }); }
  confirm(request: Request, voiceSessionId: string, body: unknown) { return this.voice.confirmTranscript({ actor: actor(request), voiceSessionId: z.string().uuid().parse(voiceSessionId), input: ConfirmVoiceTranscriptInputSchema.parse(body) }); }
  cancel(request: Request, voiceSessionId: string) { return this.voice.cancel({ actor: actor(request), correlationId: request.correlationId, voiceSessionId: z.string().uuid().parse(voiceSessionId) }); }
}
function actor(request: Request) { return { userId: request.principal.userId, active: request.principal.active }; }
Controller("api/v1/voice-updates")(VoiceUpdatesController);
UseGuards(UpdatesEvidencePolicyGuard)(VoiceUpdatesController);
Inject(VoiceUpdateService)(VoiceUpdatesController, undefined, 0);
for (const [method, path] of [["start", ""], ["revise", ":voiceSessionId/revisions"], ["confirm", ":voiceSessionId/confirm"], ["cancel", ":voiceSessionId/cancel"]] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(VoiceUpdatesController.prototype, method)!;
  Req()(VoiceUpdatesController.prototype, method, 0);
  if (method !== "start") Param("voiceSessionId")(VoiceUpdatesController.prototype, method, 1);
  if (method !== "cancel") Body()(VoiceUpdatesController.prototype, method, method === "start" ? 1 : 2);
  Post(path)(VoiceUpdatesController.prototype, method, descriptor);
}
