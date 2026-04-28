/** Chuẩn hoá mã ngôn ngữ giọng (vi_VN → vi-vn). */
export function normalizeSpeechLang(lang: string): string {
  return (lang || "").toLowerCase().replace(/_/g, "-").trim();
}

/** Giọng được coi là tiếng Việt (vi, vi-VN, vi-x-x, …). */
export function isVietnameseVoice(v: SpeechSynthesisVoice): boolean {
  const n = normalizeSpeechLang(v.lang);
  return n === "vi" || n.startsWith("vi-");
}

/** Điểm ưu tiên: vi-VN, Microsoft/Edge, Google, Neural/Natural (càng cao càng ưu tiên). */
function vietnameseVoicePriorityScore(v: SpeechSynthesisVoice): number {
  const lang = normalizeSpeechLang(v.lang);
  const name = (v.name || "").toLowerCase();
  let s = 0;
  if (lang === "vi-vn") s += 120;
  else if (lang.startsWith("vi-")) s += 60;
  if (name.includes("microsoft") || /\bedge\b/.test(name)) s += 90;
  if (name.includes("google")) s += 75;
  if (name.includes("neural") || name.includes("natural") || name.includes("online")) s += 45;
  return s;
}

/**
 * Chọn giọng Việt ưu tiên: vi-VN rõ ràng, Microsoft/Edge, Google, Neural/Natural.
 * Không trả về giọng không phải tiếng Việt.
 */
export function pickBestVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const vi = voices.filter(isVietnameseVoice);
  if (vi.length === 0) return null;
  return [...vi].sort((a, b) => vietnameseVoicePriorityScore(b) - vietnameseVoicePriorityScore(a))[0] ?? null;
}

/** Giọng đọc: URI đã lưu nếu vẫn là tiếng Việt, không thì giọng Việt tốt nhất. */
export function resolveVietnameseVoice(
  voices: SpeechSynthesisVoice[],
  preferredUri: string,
): SpeechSynthesisVoice | null {
  if (preferredUri) {
    const found = voices.find((x) => x.voiceURI === preferredUri);
    if (found && isVietnameseVoice(found)) return found;
  }
  return pickBestVietnameseVoice(voices);
}

/** Danh sách chỉ giọng Việt, sắp xếp cùng thứ tự ưu tiên với `pickBestVietnameseVoice`. */
export function filterVietnameseVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const vi = voices.filter(isVietnameseVoice);
  if (vi.length === 0) return [];
  return [...vi].sort(
    (a, b) =>
      vietnameseVoicePriorityScore(b) - vietnameseVoicePriorityScore(a) ||
      (a.name || "").localeCompare(b.name || ""),
  );
}

/** Mã BCP 47 là tiếng Việt (vi, vi-VN, …). */
export function isVietnameseLangTag(lang: string): boolean {
  const n = normalizeSpeechLang(lang);
  return n === "vi" || n.startsWith("vi-");
}

/** Giọng có `lang` khớp hoặc cùng mã ngôn ngữ gốc với `langTag`. */
export function filterVoicesByLang(
  voices: SpeechSynthesisVoice[],
  langTag: string,
): SpeechSynthesisVoice[] {
  const n = normalizeSpeechLang(langTag);
  if (!n) {
    return [...voices].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
  const exact = voices.filter((v) => normalizeSpeechLang(v.lang) === n);
  if (exact.length) {
    return exact.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
  const base = n.includes("-") ? (n.split("-")[0] ?? n) : n;
  const pref = voices.filter((v) => {
    const vn = normalizeSpeechLang(v.lang);
    return vn === base || vn.startsWith(`${base}-`);
  });
  if (pref.length) {
    return pref.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
  return [...voices].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * Chọn giọng theo ngôn ngữ đọc: tiếng Việt dùng `resolveVietnameseVoice`,
 * ngôn ngữ khác — giọng trong `filterVoicesByLang` + URI đã lưu nếu khớp.
 */
export function resolveVoiceForLang(
  voices: SpeechSynthesisVoice[],
  langTag: string,
  preferredUri: string,
): SpeechSynthesisVoice | null {
  if (isVietnameseLangTag(langTag)) {
    return resolveVietnameseVoice(voices, preferredUri);
  }
  const list = filterVoicesByLang(voices, langTag);
  if (list.length === 0) return null;
  if (preferredUri) {
    const found = list.find((x) => x.voiceURI === preferredUri);
    if (found) return found;
  }
  return list[0] ?? null;
}

let devLogLastViVoiceUri = "";

/** Dev: log khi danh sách giọng đã có dữ liệu (tránh báo sai khi getVoices() rỗng lần đầu). */
export function logVietnameseVoiceAvailability(voices: SpeechSynthesisVoice[]): void {
  if (process.env.NODE_ENV !== "development") return;
  if (voices.length === 0) {
    console.debug(
      "[TTS] getVoices() đang rỗng — Edge/Chrome thường nạp giọng sau voiceschanged; chưa kết luận thiếu tiếng Việt.",
    );
    return;
  }
  const best = pickBestVietnameseVoice(voices);
  if (best) {
    if (best.voiceURI === devLogLastViVoiceUri) return;
    devLogLastViVoiceUri = best.voiceURI;
    console.log("[TTS] Giọng tiếng Việt ưu tiên:", best.name, best.lang);
  } else {
    if (devLogLastViVoiceUri === "__no_vi__") return;
    devLogLastViVoiceUri = "__no_vi__";
    console.warn(
      "[TTS] Không có giọng tiếng Việt (vi / vi-VN). Cài thêm gói ngôn ngữ hoặc dùng Edge/Chrome trên Windows.",
    );
  }
}

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

/** Mã ngôn ngữ đọc cho AudioWeb (BCP 47), ví dụ `vi-VN`. */
export const AUDIO_WEB_SPEECH_LANG_KEY = "story-audioweb-speech-lang";
