import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  canCancelVoice,
  canRetryVoice,
  startBrowserVoiceRecording,
  VoiceCapture,
} from "./voice-capture.js";

describe("VoiceCapture", () => {
  it("keeps transcript confirmation separate from final Update confirmation", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(VoiceCapture, {
        catalog,
        scope: { projectId: crypto.randomUUID(), workstreamId: null, workItemId: null },
      }),
    );
    expect(markup).toContain(catalog["voice.confirmTranscript"]);
    expect(markup).not.toContain(catalog["updates.confirm"]);
    expect(markup).toMatch(/type="file"/u);
  });

  it("requests microphone permission and releases tracks after the injected MediaRecorder stops", async () => {
    const stop = vi.fn();
    const events = new EventTarget();
    const recorder = {
      state: "inactive",
      addEventListener: events.addEventListener.bind(events),
      start() { this.state = "recording"; },
      stop() {
        this.state = "inactive";
        const data = new Event("dataavailable") as Event & { data: Blob };
        data.data = new Blob(["voice"], { type: "audio/mp4" });
        events.dispatchEvent(data);
        events.dispatchEvent(new Event("stop"));
      },
    };
    const requestStream = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
    const recording = await startBrowserVoiceRecording(requestStream, () => recorder, true);
    const audio = await recording.stop();
    expect(audio.type).toBe("audio/mp4");
    expect(requestStream).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("keeps cancellation available through active capture states and retry explicit after failure", () => {
    expect(
      (["requesting", "recording", "uploading", "transcribing"] as const).every((status) =>
        canCancelVoice(status),
      ),
    ).toBe(true);
    expect(canCancelVoice("ready")).toBe(false);
    expect(canRetryVoice("error", true)).toBe(true);
    expect(canRetryVoice("error", false)).toBe(false);
  });
});
