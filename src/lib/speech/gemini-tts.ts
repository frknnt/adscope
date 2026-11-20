import "server-only";
import { appMode } from "@/lib/env";
import type { TtsOutcome, TtsProvider } from "./tts-provider";
import type { TtsSpeed, TtsVoice } from "./voices";
import { pcmToWav, readWav } from "./wav";

/**
 * Google Gemini speech generation (https://ai.google.dev/gemini-api/docs/speech-generation, read
 * 19.11.2026): POST {base}/v1beta/interactions with header x-goog-api-key, model
 * gemini-3.8-flash-tts by default (Turkish supported, language detected from the text). Unary
 * answers are a WAV (24 kHz, mono, 16-bit) in steps[].content[] of type "audio"; older models return
 * headerless 16-bit PCM, which is wrapped here. Only prebuilt voices are used; voice design and voice
 * replication are never requested. The request carries the line to read and a style note, nothing else.
 */
const TIMEOUT_MS = 60_000;
const SAMPLE_RATE = 24_000;
const MAX_SECONDS = 60;

/** Speed is asked for in the style note; the model has no separate rate parameter. */
const STYLE: Record<TtsSpeed, string> = {
  yavas: "Read this Turkish advertising voice-over clearly and naturally at a slightly slow, calm pace. Read only the given text.",
  normal: "Read this Turkish advertising voice-over clearly and naturally at a normal pace. Read only the given text.",
  hizli: "Read this Turkish advertising voice-over clearly and naturally at a brisk, energetic pace. Read only the given text.",
};

type Block = { type?: string; mime_type?: string; data?: string };

/** The first audio block of an Interactions answer (raw REST or SDK-like shapes). */
export function findAudio(json: unknown): Block | null {
  const j = json as { steps?: { type?: string; content?: Block[] }[]; outputs?: Block[]; output_audio?: Block };
  if (j?.output_audio?.data) return j.output_audio;
  for (const step of j?.steps ?? []) {
    if (step?.type && step.type !== "model_output") continue;
    for (const c of step?.content ?? []) if (c?.type === "audio" && c.data) return c;
  }
  for (const c of j?.outputs ?? []) if (c?.type === "audio" && c.data) return c;
  return null;
}

export class GeminiTtsProvider implements TtsProvider {
  readonly name = "Google Gemini";
  /** Measurement script only (shape of the real answer, never its content). The app never sets it. */
  onResponse?: (json: unknown) => void;
  constructor(
    private readonly key: string,
    private readonly base: string,
    readonly model: string,
  ) {}

  /** The exact request body; exported through the instance so tests can assert what leaves the app. */
  body(p: { text: string; voice: TtsVoice; speed: TtsSpeed }) {
    return {
      model: this.model,
      input: [{ type: "user_input", content: [{ type: "text", text: p.text, annotations: [{ type: "speech_metadata", style: STYLE[p.speed] }] }] }],
      response_format: { type: "audio", mime_type: "audio/wav", sample_rate: SAMPLE_RATE },
      generation_config: { speech_config: [{ voice: p.voice }] },
    };
  }

  async synthesize(p: { text: string; voice: TtsVoice; speed: TtsSpeed }): Promise<TtsOutcome> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/v1beta/interactions`, {
        method: "POST",
        headers: { "x-goog-api-key": this.key, "Content-Type": "application/json" },
        body: JSON.stringify(this.body(p)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "error",
      });
    } catch {
      console.error("[tts] request_failed");
      return { ok: false, reason: "unavailable" };
    }
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    if (res.status === 400 || res.status === 403 || res.status === 422) {
      console.error("[tts] rejected", { status: res.status });
      return { ok: false, reason: "rejected" };
    }
    if (!res.ok) {
      console.error("[tts] provider_error", { status: res.status });
      return { ok: false, reason: "unavailable" };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    this.onResponse?.(json);
    const block = findAudio(json);
    // No audio usually means the provider's safety filter blocked the line.
    if (!block?.data) return { ok: false, reason: "rejected" };
    const raw = new Uint8Array(Buffer.from(block.data, "base64"));
    const wav = readWav(raw) ? raw : raw.length >= 2 ? pcmToWav(raw, SAMPLE_RATE, 1) : null;
    const info = wav ? readWav(wav) : null;
    if (!wav || !info || info.durationSec > MAX_SECONDS) return { ok: false, reason: "unavailable" };
    return { ok: true, wav, durationSec: info.durationSec };
  }
}

export function geminiTtsFromEnv(): GeminiTtsProvider | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || process.env.TTS_DISABLED === "true") return null;
  // The endpoint override exists only for the test suite's fake server; production always uses Google.
  const base = ((appMode() !== "production" && process.env.GEMINI_API_BASE) || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const m = process.env.GEMINI_TTS_MODEL;
  return new GeminiTtsProvider(key, base, m && /^[a-z0-9.-]{3,60}$/.test(m) ? m : "gemini-3.8-flash-tts");
}
