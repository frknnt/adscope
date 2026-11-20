/**
 * Browser-safe constants of the Turkish voice-over (P11.1). Only the provider's own prebuilt
 * synthetic voices are offered; there is no option to imitate a celebrity or any real person.
 */
export const TTS_VOICES = [
  { id: "Kore", label: "Kadın sesi, net ve kararlı" },
  { id: "Sulafat", label: "Kadın sesi, sıcak" },
  { id: "Charon", label: "Erkek sesi, bilgilendirici" },
  { id: "Puck", label: "Erkek sesi, enerjik" },
] as const;
export type TtsVoice = (typeof TTS_VOICES)[number]["id"];
export const TTS_VOICE_IDS = TTS_VOICES.map((v) => v.id) as [TtsVoice, ...TtsVoice[]];

export const TTS_SPEEDS = [
  { id: "yavas", label: "Yavaş" },
  { id: "normal", label: "Normal" },
  { id: "hizli", label: "Hızlı" },
] as const;
export type TtsSpeed = (typeof TTS_SPEEDS)[number]["id"];
export const TTS_SPEED_IDS = TTS_SPEEDS.map((s) => s.id) as [TtsSpeed, ...TtsSpeed[]];

/** Longest line sent to the provider (same as a script scene's voice-over). */
export const MAX_VOICE_TEXT = 300;
/** The free preview is cut to this many seconds. */
export const PREVIEW_SECONDS = 5;

/** Shown on every voiced script and burnt into every video that uses a synthetic voice. Cannot be turned off. */
export const AI_VOICE_NOTICE = "Bu videodaki ses yapay zekâ ile üretilmiştir.";
export const AI_VOICE_SCRIPT_NOTICE =
  "Yapay zekâ ile üretilmiş ses: bu senaryonun dış sesi sentetik bir sesle okundu. Videonun son karesinde ve açıklamasında “Bu videodaki ses yapay zekâ ile üretilmiştir.” ibaresini kullan. Meta “Yapay zekâ bilgisi”, TikTok yapay zekâ etiketi ister.";
/** Rule cards this notice rests on. */
export const AI_VOICE_RULE_IDS = ["TR-RY-YZ-KARAKTER", "TR-RY-YZ-DIJITAL-KOPYA"] as const;
