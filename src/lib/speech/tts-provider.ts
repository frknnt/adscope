import type { TtsSpeed, TtsVoice } from "./voices";

export type TtsOutcome =
  | { ok: true; wav: Uint8Array; durationSec: number }
  | { ok: false; reason: "rate_limited" | "rejected" | "unavailable" };

/**
 * Text-to-speech, independent of the provider. Implementations receive only the line to read, a
 * prebuilt voice id and a speed; never the user's name, e-mail or account. They must not log text or
 * audio and must return a 16-bit PCM WAV.
 */
export interface TtsProvider {
  readonly name: string;
  readonly model: string;
  synthesize(p: { text: string; voice: TtsVoice; speed: TtsSpeed }): Promise<TtsOutcome>;
}
