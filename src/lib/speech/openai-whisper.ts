import "server-only";
import type { SpeechProvider, SpeechResult } from "./provider";

/**
 * OpenAI audio transcription (Whisper) over plain HTTPS.
 * POST {base}/v1/audio/transcriptions, multipart: file, model, language, response_format=verbose_json.
 * Enabled only when SPEECH_TO_TEXT_API_KEY is set. Audio is sent once and never stored by AdScope.
 */
export class OpenAiWhisperProvider implements SpeechProvider {
  readonly name = "openai-whisper";
  readonly enabled: boolean;

  constructor(
    private apiKey = process.env.SPEECH_TO_TEXT_API_KEY,
    private model = process.env.SPEECH_TO_TEXT_MODEL || "whisper-1",
    private baseUrl = (process.env.SPEECH_TO_TEXT_BASE_URL || "https://api.openai.com").replace(/\/+$/, ""),
  ) {
    this.enabled = Boolean(apiKey);
  }

  async transcribe(wav: Uint8Array, opts: { language: "tr" }): Promise<SpeechResult> {
    const started = Date.now();
    const elapsed = () => Date.now() - started;
    if (!this.apiKey) return { ok: false, reason: "not_configured", latencyMs: 0 };
    const form = new FormData();
    form.set("file", new Blob([Buffer.from(wav)], { type: "audio/wav" }), "audio.wav");
    form.set("model", this.model);
    form.set("language", opts.language);
    form.set("response_format", "verbose_json");
    try {
      const res = await fetch(`${this.baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return { ok: false, reason: "api_error", latencyMs: elapsed() };
      const data = (await res.json().catch(() => null)) as { text?: unknown; segments?: unknown } | null;
      if (!data || typeof data.text !== "string") return { ok: false, reason: "invalid_response", latencyMs: elapsed() };
      const segments = Array.isArray(data.segments)
        ? data.segments
            .filter((s): s is { start: number; end: number; text: string } => typeof s?.start === "number" && typeof s?.end === "number" && typeof s?.text === "string")
            .slice(0, 400)
            .map((s) => ({ start: s.start, end: s.end, text: s.text.trim().slice(0, 500) }))
        : [];
      return { ok: true, transcript: { text: data.text.trim().slice(0, 6000), segments, provider: this.name }, latencyMs: elapsed() };
    } catch (e) {
      return { ok: false, reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "api_error", latencyMs: elapsed() };
    }
  }
}

export function getSpeechProvider(): SpeechProvider | null {
  const p = new OpenAiWhisperProvider();
  return p.enabled ? p : null;
}
