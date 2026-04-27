import { Platform } from "react-native";
import * as Speech from "expo-speech";

/** Bỏ thẻ HTML để TTS không đọc tên thẻ (nội dung CMS thường là HTML). */
function textForSpeech(raw: string): string {
  const noTags = raw.replace(/<[^>]+>/g, " ");
  return noTags.replace(/\s+/g, " ").trim();
}

let speechCancelledByUser = false;

export function stopChapterSpeech(): void {
  speechCancelledByUser = true;
  if (Platform.OS === "web" && typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    return;
  }
  Speech.stop();
}

type SpeakOpts = {
  onEnd: () => void;
  /** Chỉ gọi khi đọc xong tự nhiên (không gọi khi người dùng bấm dừng / lỗi). */
  onNaturalComplete?: () => void;
};

export function speakChapterContent(rawContent: string, opts: SpeakOpts): void {
  const text = textForSpeech(rawContent);
  if (!text) {
    opts.onEnd();
    return;
  }

  speechCancelledByUser = false;

  if (Platform.OS === "web" && typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.rate = 0.95;
    utterance.onend = () => {
      if (!speechCancelledByUser) {
        opts.onNaturalComplete?.();
      }
      opts.onEnd();
    };
    utterance.onerror = () => opts.onEnd();
    window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    return;
  }

  Speech.speak(text, {
    language: "vi-VN",
    pitch: 1.0,
    rate: 0.95,
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
