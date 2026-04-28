"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  AUDIO_WEB_SPEECH_LANG_KEY,
  BROWSER_SPEECH_VOICE_URI_KEY,
  filterVietnameseVoices,
  filterVoicesByLang,
  isVietnameseLangTag,
  logVietnameseVoiceAvailability,
  normalizeSpeechLang,
  resolveVoiceForLang,
} from "@/lib/browserSpeech";
import {
  initialSleepFromPrefs,
  loadAudioReadPrefs,
  saveAudioReadPrefs,
} from "@/lib/audioReadPreferences";

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;
const SLEEP_OPTIONS = [
  { label: "Tắt", minutes: 0 },
  { label: "15 phút", minutes: 15 },
  { label: "30 phút", minutes: 30 },
  { label: "45 phút", minutes: 45 },
  { label: "60 phút", minutes: 60 },
  { label: "90 phút", minutes: 90 },
] as const;

const LANG_PRESETS: { value: string; label: string }[] = [
  { value: "vi-VN", label: "Tiếng Việt (Việt Nam)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "ja-JP", label: "日本語（日本）" },
  { value: "zh-CN", label: "中文（简体）" },
  { value: "ko-KR", label: "한국어（대한민국）" },
  { value: "fr-FR", label: "Français (France)" },
  { value: "de-DE", label: "Deutsch (Deutschland)" },
];

function buildLangOptions(voices: SpeechSynthesisVoice[]): { value: string; label: string }[] {
  const map = new Map<string, { value: string; label: string }>();
  for (const p of LANG_PRESETS) {
    map.set(normalizeSpeechLang(p.value), { value: p.value, label: p.label });
  }
  for (const v of voices) {
    const n = normalizeSpeechLang(v.lang);
    if (!n || map.has(n)) continue;
    const raw = (v.lang || "").includes("_") ? v.lang.replace(/_/g, "-") : (v.lang || n);
    map.set(n, { value: raw, label: n });
  }
  const out = [...map.values()];
  out.sort((a, b) => {
    const na = normalizeSpeechLang(a.value);
    const nb = normalizeSpeechLang(b.value);
    if (na.startsWith("vi") && !nb.startsWith("vi")) return -1;
    if (!na.startsWith("vi") && nb.startsWith("vi")) return 1;
    return a.label.localeCompare(b.label, "vi");
  });
  return out;
}

function formatSleepTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Tách văn bản thành các câu theo `.`, `?`, `!` (theo spec AudioPlayer.md). */
export function splitIntoSentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  try {
    const chunks = t.split(/(?<=[.!?])\s+/);
    return chunks.map((c) => c.trim()).filter(Boolean);
  } catch {
    const parts = t.split(/([.?!])\s+/);
    const out: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const chunk = (parts[i] ?? "") + (parts[i + 1] ?? "");
      if (chunk.trim()) out.push(chunk.trim());
    }
    return out;
  }
}

export type AudioWebReadingHighlight = {
  sentenceIndex: number | null;
  isPlaying: boolean;
  /** Vị trí ký tự trong câu `sentenceIndex` (onboundary `word`). */
  wordInSentence: { start: number; end: number } | null;
};

export type AudioWebHandle = {
  /** Phát từ câu `index` (hủy queue hiện tại). */
  playFromSentence: (index: number) => void;
};

export type AudioWebProps = {
  text: string;
  /** Khi đọc xong câu cuối (không dừng tay), ví dụ chuyển chương sau. */
  onReadthroughEnd?: () => void;
  /** Khóa localStorage để nhớ câu đang đọc (F5 tiếp tục). Bỏ qua thì không lưu. */
  positionStorageKey?: string;
  className?: string;
  /**
   * Ref mảng phần tử DOM từng câu trên trang (cùng thứ tự với `splitIntoSentences(text)`).
   * Dùng để `scrollIntoView` khi đang phát.
   */
  sentenceElementsRef?: React.MutableRefObject<(HTMLElement | null)[]>;
  /** Đồng bộ highlight / câu đang đọc với nội dung hiển thị ngoài component. */
  onHighlightChange?: (state: AudioWebReadingHighlight) => void;
};

/**
 * Điều khiển TTS theo câu (Web Speech API). Không render nội dung chương —
 * trang cha hiển thị văn bản và truyền `sentenceElementsRef` + `onHighlightChange`.
 */
export const AudioWeb = forwardRef<AudioWebHandle, AudioWebProps>(function AudioWeb(
  { text, onReadthroughEnd, positionStorageKey, className = "", sentenceElementsRef, onHighlightChange },
  ref,
) {
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(() => loadAudioReadPrefs().playbackRate);
  const [voiceUri, setVoiceUri] = useState("");
  const [speechLang, setSpeechLang] = useState("vi-VN");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [wordRange, setWordRange] = useState<{ start: number; end: number } | null>(null);
  const [volume, setVolume] = useState(() => loadAudioReadPrefs().volume);
  const sleepInitAw = initialSleepFromPrefs(loadAudioReadPrefs());
  const [sleepTimer, setSleepTimer] = useState(sleepInitAw.preset);
  const [sleepTimeLeft, setSleepTimeLeft] = useState<number | null>(sleepInitAw.left);
  const isFirstSleepEffectAwRef = useRef(true);
  const initialSleepLeftAwRef = useRef<number | null>(sleepInitAw.left);
  const [showReadSettings, setShowReadSettings] = useState(false);
  const [readMenuPlacement, setReadMenuPlacement] = useState<{
    bottom: number;
    right: number;
    maxHeight: number;
  } | null>(null);

  const readSettingsRef = useRef<HTMLDivElement>(null);
  const readSettingsPopoverRef = useRef<HTMLDivElement>(null);

  const langOptions = useMemo(() => buildLangOptions(voices), [voices]);
  const voiceList = useMemo(() => {
    if (isVietnameseLangTag(speechLang)) {
      return filterVietnameseVoices(voices);
    }
    return filterVoicesByLang(voices, speechLang);
  }, [voices, speechLang]);

  const sentencesRef = useRef<string[]>([]);
  const rateRef = useRef(rate);
  const voiceUriRef = useRef(voiceUri);
  const speechLangRef = useRef(speechLang);
  const volumeRef = useRef(volume);
  const isPlayingRef = useRef(false);
  const currentIndexRef = useRef(currentIndex);
  const onHighlightChangeRef = useRef(onHighlightChange);
  const onReadthroughEndRef = useRef(onReadthroughEnd);

  sentencesRef.current = sentences;
  rateRef.current = rate;
  voiceUriRef.current = voiceUri;
  speechLangRef.current = speechLang;
  volumeRef.current = volume;
  isPlayingRef.current = isPlaying;
  currentIndexRef.current = currentIndex;
  onHighlightChangeRef.current = onHighlightChange;
  onReadthroughEndRef.current = onReadthroughEnd;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BROWSER_SPEECH_VOICE_URI_KEY);
      if (raw) setVoiceUri(raw);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUDIO_WEB_SPEECH_LANG_KEY);
      if (raw?.trim()) setSpeechLang(raw.trim());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const sync = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        logVietnameseVoiceAvailability(list);
        setVoices(list);
      } catch {
        setVoices([]);
      }
    };
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", sync);
  }, []);

  useEffect(() => {
    if (langOptions.length === 0) return;
    const n = normalizeSpeechLang(speechLang);
    const hit = langOptions.find((o) => normalizeSpeechLang(o.value) === n);
    if (!hit) {
      setSpeechLang("vi-VN");
      try {
        localStorage.setItem(AUDIO_WEB_SPEECH_LANG_KEY, "vi-VN");
      } catch {
        /* ignore */
      }
      return;
    }
    if (hit.value !== speechLang) {
      setSpeechLang(hit.value);
    }
  }, [langOptions, speechLang]);

  useEffect(() => {
    if (!voiceUri) return;
    if (voiceList.length === 0) return;
    if (!voiceList.some((v) => v.voiceURI === voiceUri)) {
      setVoiceUri("");
      try {
        localStorage.removeItem(BROWSER_SPEECH_VOICE_URI_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [voiceUri, voiceList]);

  useEffect(() => {
    if (sleepTimer <= 0) {
      setSleepTimeLeft(null);
      saveAudioReadPrefs({ sleepPresetMinutes: 0, sleepDeadlineAt: null });
      isFirstSleepEffectAwRef.current = false;
      return;
    }

    if (isFirstSleepEffectAwRef.current) {
      isFirstSleepEffectAwRef.current = false;
      const leftNow = initialSleepLeftAwRef.current ?? sleepTimer * 60;
      initialSleepLeftAwRef.current = null;
      saveAudioReadPrefs({
        sleepPresetMinutes: sleepTimer,
        sleepDeadlineAt: Date.now() + leftNow * 1000,
      });
    } else {
      const full = sleepTimer * 60;
      setSleepTimeLeft(full);
      saveAudioReadPrefs({
        sleepPresetMinutes: sleepTimer,
        sleepDeadlineAt: Date.now() + full * 1000,
      });
    }

    const interval = setInterval(() => {
      setSleepTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
          saveAudioReadPrefs({ sleepPresetMinutes: 0, sleepDeadlineAt: null });
          return 0;
        }
        const next = prev - 1;
        if (next > 0 && next % 12 === 0) {
          saveAudioReadPrefs({
            sleepPresetMinutes: sleepTimer,
            sleepDeadlineAt: Date.now() + next * 1000,
          });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimer]);

  useEffect(() => {
    if (sleepTimeLeft !== 0) return;
    if (sleepTimer <= 0) return;
    setSleepTimer(0);
    setIsPlaying(false);
    setWordRange(null);
  }, [sleepTimeLeft, sleepTimer]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!(t instanceof Node)) return;
      if (showReadSettings) {
        const inTrigger = readSettingsRef.current?.contains(t) ?? false;
        const inPopover = readSettingsPopoverRef.current?.contains(t) ?? false;
        if (!inTrigger && !inPopover) {
          setShowReadSettings(false);
        }
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [showReadSettings]);

  useLayoutEffect(() => {
    if (!showReadSettings) {
      setReadMenuPlacement(null);
      return;
    }
    const update = () => {
      const wrap = readSettingsRef.current;
      if (!wrap || typeof window === "undefined") return;
      const rect = wrap.getBoundingClientRect();
      const gap = 8;
      setReadMenuPlacement({
        bottom: window.innerHeight - rect.top + gap,
        right: window.innerWidth - rect.right,
        maxHeight: Math.max(140, rect.top - gap - 16),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showReadSettings]);

  useEffect(() => {
    const list = splitIntoSentences(text);
    setSentences(list);

    let initial = 0;
    if (positionStorageKey && typeof window !== "undefined" && list.length > 0) {
      try {
        const raw = localStorage.getItem(positionStorageKey);
        if (raw != null) {
          const n = parseInt(raw, 10);
          if (Number.isFinite(n)) {
            initial = Math.min(Math.max(0, n), list.length - 1);
          }
        }
      } catch {
        /* ignore */
      }
    }
    setCurrentIndex(list.length ? initial : -1);
    setWordRange(null);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setShowReadSettings(false);
  }, [text, positionStorageKey]);

  useEffect(() => {
    if (!positionStorageKey || typeof window === "undefined") return;
    if (currentIndex < 0) return;
    try {
      localStorage.setItem(positionStorageKey, String(currentIndex));
    } catch {
      /* ignore */
    }
  }, [currentIndex, positionStorageKey]);

  useEffect(() => {
    const cb = onHighlightChangeRef.current;
    if (!cb) return;
    cb({
      sentenceIndex: currentIndex >= 0 ? currentIndex : null,
      isPlaying,
      wordInSentence: wordRange,
    });
  }, [currentIndex, isPlaying, wordRange]);

  useLayoutEffect(() => {
    if (!isPlaying || currentIndex < 0) return;
    const external = sentenceElementsRef?.current?.[currentIndex];
    if (external) {
      external.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, isPlaying, sentenceElementsRef]);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setWordRange(null);
  }, []);

  const speakFrom = useCallback(
    (index: number) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const list = sentencesRef.current;
      if (index < 0 || index >= list.length) return;

      window.speechSynthesis.cancel();
      setWordRange(null);

      const utterance = new SpeechSynthesisUtterance(list[index]);
      const lang = speechLangRef.current?.trim() || "vi-VN";
      utterance.lang = lang;
      utterance.rate = Math.min(2, Math.max(0.5, rateRef.current));
      utterance.volume = Math.max(0, Math.min(1, volumeRef.current));

      const v = resolveVoiceForLang(voices, lang, voiceUriRef.current);
      if (v) utterance.voice = v;

      utterance.onstart = () => {
        setCurrentIndex(index);
        setIsPlaying(true);
        setWordRange(null);
      };

      utterance.onboundary = (event) => {
        if (event.name !== "word" || typeof event.charIndex !== "number") return;
        const sentence = list[index];
        const from = event.charIndex;
        const tail = sentence.slice(from);
        const m = tail.match(/^\S+/);
        const len = m ? m[0].length : 0;
        if (len > 0) {
          setWordRange({ start: from, end: from + len });
        }
      };

      utterance.onend = () => {
        setWordRange(null);
        if (index < list.length - 1) {
          speakFrom(index + 1);
        } else {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setCurrentIndex(-1);
          onReadthroughEndRef.current?.();
        }
      };

      utterance.onerror = () => {
        setIsPlaying(false);
        setWordRange(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [voices],
  );

  useImperativeHandle(
    ref,
    () => ({
      playFromSentence: (index: number) => {
        speakFrom(index);
      },
    }),
    [speakFrom],
  );

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      stopSpeech();
      return;
    }
    const list = sentencesRef.current;
    if (list.length === 0) return;
    const start =
      currentIndex >= 0 && currentIndex < list.length ? currentIndex : 0;
    speakFrom(start);
  }, [currentIndex, speakFrom, stopSpeech]);

  const seekTo = useCallback(
    (index: number) => {
      const list = sentencesRef.current;
      if (list.length === 0) return;
      const clamped = Math.min(Math.max(0, index), list.length - 1);
      setCurrentIndex(clamped);
      setWordRange(null);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (isPlayingRef.current) {
        speakFrom(clamped);
      } else {
        setIsPlaying(false);
      }
    },
    [speakFrom],
  );

  useEffect(() => {
    if (!isPlayingRef.current) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const list = sentencesRef.current;
    if (list.length === 0) return;
    const idx = Math.min(
      Math.max(0, currentIndexRef.current),
      list.length - 1,
    );
    speakFrom(idx);
  }, [rate, voiceUri, volume, speechLang, speakFrom]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    saveAudioReadPrefs({ volume: v });
  }, []);

  const handleSpeedPick = useCallback((speed: number) => {
    setRate(speed);
    saveAudioReadPrefs({ playbackRate: speed });
  }, []);

  const sliderMax = Math.max(0, sentences.length - 1);
  const sliderValue = currentIndex < 0 ? 0 : Math.min(currentIndex, sliderMax);

  return (
    <div
      className={`mx-auto flex max-w-2xl flex-col rounded-2xl border border-indigo-200/40 bg-gradient-to-b from-indigo-50/90 via-white to-violet-50/50 shadow-lg dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-zinc-950 dark:to-violet-950/20 ${className}`}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={sentences.length === 0}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-md transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPlaying ? "Tạm dừng" : "Phát"}
          </button>
          <div className="relative shrink-0" ref={readSettingsRef}>
            <button
              type="button"
              aria-expanded={showReadSettings}
              aria-haspopup="true"
              aria-label="Cài đặt đọc"
              title="Cài đặt"
              onClick={(e) => {
                e.stopPropagation();
                setShowReadSettings((v) => !v);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200/90 bg-white/90 text-zinc-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-800 dark:border-zinc-600 dark:bg-zinc-900/85 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200 ${
                sleepTimer > 0 || rate !== 1 || !isVietnameseLangTag(speechLang)
                  ? "ring-2 ring-indigo-400/35 dark:ring-indigo-500/30"
                  : ""
              }`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Câu ({sentences.length}){rate !== 1 ? ` · ${rate}×` : ""}
          </label>
          <input
            type="range"
            min={0}
            max={sliderMax || 0}
            step={1}
            value={sentences.length === 0 ? 0 : sliderValue}
            disabled={sentences.length === 0}
            onChange={(e) => seekTo(parseInt(e.target.value, 10))}
            className="w-full cursor-pointer accent-indigo-600 disabled:cursor-not-allowed dark:accent-indigo-400"
            aria-label="Chọn câu"
          />
        </div>
      </div>
      {showReadSettings && readMenuPlacement && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={readSettingsPopoverRef}
              role="menu"
              className="z-[100] w-[min(17.5rem,calc(100vw-1.5rem))] space-y-3 overflow-y-auto rounded-xl border border-zinc-200/90 bg-white/98 p-3 shadow-2xl ring-1 ring-black/5 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/98 dark:ring-white/10"
              style={{
                position: "fixed",
                right: readMenuPlacement.right,
                bottom: readMenuPlacement.bottom,
                maxHeight: readMenuPlacement.maxHeight,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Âm lượng
                </p>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden>
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    </svg>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={handleVolumeChange}
                    className="h-1 min-w-0 flex-1 cursor-pointer accent-indigo-600 dark:accent-indigo-500"
                    aria-label="Âm lượng"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="audioweb-lang-settings"
                  className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Ngôn ngữ đọc
                </label>
                <select
                  id="audioweb-lang-settings"
                  aria-label="Ngôn ngữ đọc"
                  value={speechLang}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSpeechLang(v);
                    try {
                      localStorage.setItem(AUDIO_WEB_SPEECH_LANG_KEY, v);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="w-full cursor-pointer rounded-lg border border-zinc-200/90 bg-white py-1.5 pl-2 pr-8 text-xs font-medium text-zinc-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {langOptions.map((o) => (
                    <option key={normalizeSpeechLang(o.value)} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Tốc độ
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSpeedPick(speed)}
                      className={`rounded-lg border px-1 py-1.5 text-center text-[10px] font-bold tabular-nums transition ${
                        rate === speed
                          ? "border-indigo-400 bg-indigo-600 text-white shadow-sm dark:border-indigo-500"
                          : "border-zinc-200/90 bg-zinc-50/80 text-zinc-700 hover:border-indigo-200 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Hẹn giờ tắt
                </p>
                <div className="flex flex-wrap gap-1">
                  {SLEEP_OPTIONS.map((opt) => (
                    <button
                      key={opt.minutes}
                      type="button"
                      role="menuitem"
                      onClick={() => setSleepTimer(opt.minutes)}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition ${
                        sleepTimer === opt.minutes
                          ? "border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-600 dark:bg-sky-950/60 dark:text-sky-100"
                          : "border-zinc-200/90 bg-white text-zinc-600 hover:border-indigo-200 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {sleepTimeLeft !== null && sleepTimeLeft > 0 ? (
                  <p className="mt-1.5 font-mono text-[10px] text-sky-700 dark:text-sky-300">
                    Còn {formatSleepTime(sleepTimeLeft)}
                  </p>
                ) : null}
              </div>
              {voiceList.length > 0 ? (
                <div>
                  <label
                    htmlFor="audioweb-voice-settings"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    Giọng đọc
                  </label>
                  <select
                    id="audioweb-voice-settings"
                    aria-label="Giọng đọc trình duyệt"
                    title="Giọng đọc trình duyệt"
                    className="w-full max-w-full cursor-pointer truncate rounded-lg border border-zinc-200/90 bg-white py-1.5 pl-2 pr-8 text-xs font-medium text-zinc-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    value={voiceUri}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVoiceUri(v);
                      try {
                        if (v) localStorage.setItem(BROWSER_SPEECH_VOICE_URI_KEY, v);
                        else localStorage.removeItem(BROWSER_SPEECH_VOICE_URI_KEY);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <option value="">Mặc định (tiếng Việt)</option>
                    {voiceList.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI} title={`${v.name} (${v.lang})`}>
                        {v.name.length > 28 ? `${v.name.slice(0, 26)}…` : v.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
});
