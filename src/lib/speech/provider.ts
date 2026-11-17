import type { SpeechTranscript } from "@/lib/engine/types";

export type SpeechResult =
  | { ok: true; transcript: SpeechTranscript; latencyMs: number }
  | { ok: false; reason: "not_configured" | "api_error" | "timeout" | "invalid_response"; latencyMs: number };

/** Speech-to-text. Implementations must never log audio or transcripts. */
export interface SpeechProvider {
  readonly name: string;
  readonly enabled: boolean;
  transcribe(wav: Uint8Array, opts: { language: "tr" }): Promise<SpeechResult>;
}
