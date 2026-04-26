/** Chuẩn hoá văn bản gửi SpeechSynthesis (một đoạn, không xuống dòng dài). */
export function plainTextForSpeech(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Ước lượng độ dài đọc (giây) — chỉ để thanh tiến độ; thực tế kết thúc theo sự kiện `end`. */
export function estimateSpeechDurationSec(text: string, rate: number): number {
  const t = plainTextForSpeech(text);
  if (!t) return 1;
  const r = Math.max(0.5, Math.min(2.5, rate));
  const base = Math.max(10, t.length / 12);
  return Math.max(8, base / r);
}

export const BROWSER_SPEECH_VOICE_URI_KEY = "story-browser-tts-voice-uri";
