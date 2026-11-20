/**
 * Credit cost of the Turkish voice-over (P11.1), kept apart from the other cost tables.
 *
 * Basis (not yet measured with a real key; `npm run ai:eval -- --confirm` measures it once the key is
 * set): Gemini API pricing page, read 19.11.2026, model gemini-3.8-flash-tts, standard tier:
 * 0.50 $ per 1M input text tokens and 9 $ per 1M output audio tokens until 31.12.2026, then 1 $ and
 * 18 $ from 01.01.2027. Audio is 25 tokens per second. A full 45-second script is about 1,125 audio
 * tokens: ~0.010 $ now, ~0.020 $ from 2027, i.e. ~0.46 TL / ~0.91 TL at 45 TL/$. One credit nets
 * about 2.95 TL after VAT and payment fees, so one credit per voice-over job keeps the margin above
 * 50 % even at the 2027 price. A 5-second preview is ~0.0023 $ at most; it is free but rate limited.
 */
export const VOICEOVER_CREDIT_COST = 1;
export const TTS_PRICE_USD = { inputPerMTok: 0.5, audioPerMTok: 9, audioPerMTok2027: 18, audioTokensPerSecond: 25 } as const;

/** Estimated provider cost in US dollars for the given seconds of audio and input characters. */
export function ttsCostUsd(seconds: number, chars: number, from2027 = false): number {
  const audio = (seconds * TTS_PRICE_USD.audioTokensPerSecond * (from2027 ? TTS_PRICE_USD.audioPerMTok2027 : TTS_PRICE_USD.audioPerMTok)) / 1e6;
  // Roughly 4 characters per text token; doubled from 2027 like the audio price.
  const text = ((chars / 4) * TTS_PRICE_USD.inputPerMTok * (from2027 ? 2 : 1)) / 1e6;
  return audio + text;
}
