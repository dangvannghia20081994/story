import { Platform } from "react-native";
import * as Speech from "expo-speech";

/** Bỏ thẻ HTML + entity phổ biến để TTS không đọc rác (CMS thường HTML). */
function textForSpeech(raw: string): string {
  let s = raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCharCode(n) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCharCode(n) : " ";
    });
  s = s.replace(/<[^>]+>/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

let speechCancelledByUser = false;
/** Giữ reference trên web — một số trình duyệt cắt utterance nếu bị GC sớm. */
let webUtterance: SpeechSynthesisUtterance | null = null;

export function stopChapterSpeech(): void {
  speechCancelledByUser = true;
  if (Platform.OS === "web" && typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    webUtterance = null;
    return;
  }
  Speech.stop();
}

type SpeakOpts = {
  onEnd: () => void;
  /** Chỉ gọi khi đọc xong tự nhiên (không gọi khi người dùng bấm dừng / lỗi). */
  onNaturalComplete?: () => void;
};

function pickViVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const lower = (s: string) => s.toLowerCase();
  return (
    voices.find((v) => lower(v.lang).startsWith("vi")) ??
    voices.find((v) => lower(v.lang).includes("viet")) ??
    null
  );
}

export function speakChapterContent(rawContent: string, opts: SpeakOpts): void {
  const text = textForSpeech(rawContent);
  if (!text) {
    opts.onEnd();
    return;
  }

  speechCancelledByUser = false;

  if (Platform.OS === "web" && typeof window !== "undefined" && window.speechSynthesis) {
    const syn = window.speechSynthesis;
    syn.cancel();
    webUtterance = null;

    const speakNow = () => {
      if (speechCancelledByUser) {
        opts.onEnd();
        return;
      }
      webUtterance = new SpeechSynthesisUtterance(text);
      const u = webUtterance;
      u.lang = "vi-VN";
      u.rate = 1;
      const voice = pickViVoice(syn.getVoices());
      if (voice) {
        u.voice = voice;
      }
      u.onend = () => {
        webUtterance = null;
        if (!speechCancelledByUser) {
          opts.onNaturalComplete?.();
        }
        opts.onEnd();
      };
      u.onerror = () => {
        webUtterance = null;
        opts.onEnd();
      };
      syn.speak(u);
      try {
        syn.resume();
      } catch {
        /* một số trình duyệt không hỗ trợ resume */
      }
    };

    /** Chrome/Edge: getVoices() rỗng tới khi voiceschanged — không thì lần speak đầu thường im lặng. */
    let started = false;
    const startOnce = () => {
      if (started) return;
      started = true;
      syn.removeEventListener("voiceschanged", startOnce);
      speakNow();
    };

    void syn.getVoices();
    if (syn.getVoices().length === 0) {
      syn.addEventListener("voiceschanged", startOnce);
      window.setTimeout(startOnce, 500);
      return;
    }
    startOnce();
    return;
  }

  Speech.speak(text, {
    language: "vi-VN",
    pitch: 1.0,
    rate: 1.0,
    onDone: () => {
      if (!speechCancelledByUser) {
        opts.onNaturalComplete?.();
      }
      opts.onEnd();
    },
    onStopped: () => opts.onEnd(),
    onError: () => opts.onEnd(),
  });
}
