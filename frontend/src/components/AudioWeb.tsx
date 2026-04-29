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
import type { ChangeEvent, MouseEvent, MutableRefObject } from "react";

import {
  AUDIO_WEB_SPEECH_LANG_KEY,
  BROWSER_SPEECH_VOICE_URI_KEY,
  filterVietnameseVoices,
  filterVoicesByLang,
  isVietnameseLangTag,
  logVietnameseVoiceAvailability,
  normalizeSpeechLang,
  pickFallbackSpeechVoice,
  resolveVoiceForLang,
} from "@/lib/browserSpeech";
import { loadAudioReadPrefs, saveAudioReadPrefs, tryConsumeExpiredAudioReadSleep } from "@/lib/audioReadPreferences";
import { STORY_AUDIOREAD_SLEEP_ENDED, useAudioReadSleep } from "@/contexts/AudioReadSleepContext";

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;

const SLEEP_OPTIONS = [
  { label: "Tắt", minutes: 0 },
  { label: "3 phút (thử)", minutes: 3 },
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
  wordInSentence: { start: number; end: number } | null;
};

export type AudioWebHandle = {
  playFromSentence: (index: number) => void;
};

export type AudioWebProps = {
  text: string;
  onReadthroughEnd?: () => void;
  /** localStorage: tiến độ câu — nên dùng slug (`story-audioweb:{storySlug}:{chapterKey}`) khớp URL. */
  positionStorageKey?: string;
  /** Key cũ dạng `story-audioweb:{storyId}:{chapterId}`: đọc một lần rồi chép sang `positionStorageKey` nếu có. */
  positionStorageLegacyKey?: string;
  className?: string;
  sentenceElementsRef?: MutableRefObject<(HTMLElement | null)[]>;
  onHighlightChange?: (state: AudioWebReadingHighlight) => void;
  /** Chuyển chương (trang listen): hiện nút Prev/Next cạnh tua câu khi cả hai callback đều có. */
  onGoToPreviousChapter?: () => void;
  onGoToNextChapter?: () => void;
  canGoToPreviousChapter?: boolean;
  canGoToNextChapter?: boolean;
};

function chipClass(active: boolean) {
  return `rounded-full border px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
    active
      ? "border-transparent bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25 dark:from-indigo-500 dark:to-violet-500 dark:shadow-indigo-900/40"
      : "border-gray-300 bg-white text-gray-600 hover:border-indigo-200 hover:bg-gradient-to-r hover:from-indigo-50/90 hover:to-violet-50/80 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-indigo-500/50 dark:hover:from-indigo-950/40 dark:hover:to-violet-950/30"
  }`;
}

export const AudioWeb = forwardRef<AudioWebHandle, AudioWebProps>(function AudioWeb(
  {
    text,
    onReadthroughEnd,
    positionStorageKey,
    positionStorageLegacyKey,
    className = "",
    sentenceElementsRef,
    onHighlightChange,
    onGoToPreviousChapter,
    onGoToNextChapter,
    canGoToPreviousChapter = false,
    canGoToNextChapter = false,
  },
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
  const { sleepTimer, sleepTimeLeft, setSleepTimer } = useAudioReadSleep();
  const progressTrackRef = useRef<HTMLDivElement>(null);

  const langOptions = useMemo(() => buildLangOptions(voices), [voices]);
  const voiceList = useMemo(() => {
    if (isVietnameseLangTag(speechLang)) {
      return filterVietnameseVoices(voices);
    }
    return filterVoicesByLang(voices, speechLang);
  }, [voices, speechLang]);

  /** Đang chọn tiếng Việt nhưng máy không có giọng vi — phát sẽ dùng giọng dự phòng. */
  const speechFallbackVoice = useMemo(() => {
    if (!isVietnameseLangTag(speechLang)) return null;
    if (filterVietnameseVoices(voices).length > 0) return null;
    return pickFallbackSpeechVoice(voices);
  }, [speechLang, voices]);

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
    return () => {
      isPlayingRef.current = false;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

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
    const list = splitIntoSentences(text);
    setSentences(list);

    let initial = 0;
    if (positionStorageKey && typeof window !== "undefined" && list.length > 0) {
      try {
        let raw = localStorage.getItem(positionStorageKey);
        if (raw == null && positionStorageLegacyKey) {
          raw = localStorage.getItem(positionStorageLegacyKey);
          if (raw != null) {
            localStorage.setItem(positionStorageKey, raw);
          }
        }
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
    isPlayingRef.current = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, [text, positionStorageKey, positionStorageLegacyKey]);

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
    isPlayingRef.current = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setWordRange(null);
  }, []);

  useEffect(() => {
    const onSleepEnded = () => {
      stopSpeech();
    };
    window.addEventListener(STORY_AUDIOREAD_SLEEP_ENDED, onSleepEnded);
    return () => window.removeEventListener(STORY_AUDIOREAD_SLEEP_ENDED, onSleepEnded);
  }, [stopSpeech]);

  const speakFrom = useCallback(
    (startIndex: number) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const list = sentencesRef.current;
      if (startIndex < 0 || startIndex >= list.length) return;

      window.speechSynthesis.cancel();
      setWordRange(null);

      isPlayingRef.current = true;
      setIsPlaying(true);
      setCurrentIndex(startIndex);

      // Speak one sentence at a time — chain via onend to avoid inter-sentence delay
      const speakOne = (i: number) => {
        // Guard: stop if playback was cancelled externally
        if (!isPlayingRef.current) return;
        if (tryConsumeExpiredAudioReadSleep()) return;

        const list = sentencesRef.current;
        if (i < 0 || i >= list.length) return;

        const sentenceText = list[i];
        const lang = speechLangRef.current?.trim() || "vi-VN";
        const safeRate = Math.min(2, Math.max(0.5, rateRef.current));
        const safeVol = Math.max(0, Math.min(1, volumeRef.current));
        const v = resolveVoiceForLang(voices, lang, voiceUriRef.current);

        const utterance = new SpeechSynthesisUtterance(sentenceText);
        utterance.rate = safeRate;
        utterance.volume = safeVol;
        if (v) {
          utterance.voice = v;
          // Khớp lang với giọng thật — nếu để vi-VN mà không có gói Vi, nhiều engine không phát âm thanh.
          const vl = (v.lang || "").trim();
          utterance.lang = vl || lang;
        } else {
          utterance.lang = lang;
        }

        utterance.onstart = () => {
          setCurrentIndex(i);
          setIsPlaying(true);
          setWordRange(null);
        };

        utterance.onboundary = (event) => {
          if (event.name !== "word" || typeof event.charIndex !== "number") return;
          const from = event.charIndex;
          const tail = sentenceText.slice(from);
          const m = tail.match(/^\S+/);
          const len = m ? m[0].length : 0;
          if (len > 0) setWordRange({ start: from, end: from + len });
        };

        utterance.onend = () => {
          setWordRange(null);
          if (!isPlayingRef.current) return;
          if (tryConsumeExpiredAudioReadSleep()) return;
          const next = i + 1;
          if (next < sentencesRef.current.length) {
            // Tiny setTimeout(0) prevents Chrome's internal queue delay
            setTimeout(() => {
              if (tryConsumeExpiredAudioReadSleep()) return;
              speakOne(next);
            }, 0);
          } else {
            isPlayingRef.current = false;
            setIsPlaying(false);
            setCurrentIndex(-1);
            onReadthroughEndRef.current?.();
          }
        };

        utterance.onerror = (event) => {
          const code = event.error;
          if (code === "canceled" || code === "interrupted") {
            isPlayingRef.current = false;
            setIsPlaying(false);
            setWordRange(null);
            return;
          }
          isPlayingRef.current = false;
          setIsPlaying(false);
          setWordRange(null);
        };

        window.speechSynthesis.speak(utterance);
      };

      speakOne(startIndex);
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
    const start = currentIndex >= 0 && currentIndex < list.length ? currentIndex : 0;
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
    const idx = Math.min(Math.max(0, currentIndexRef.current), list.length - 1);
    speakFrom(idx);
  }, [rate, voiceUri, volume, speechLang, speakFrom]);

  const handleVolumeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    saveAudioReadPrefs({ volume: v });
  }, []);

  const handleSpeedPick = useCallback((speed: number) => {
    setRate(speed);
    saveAudioReadPrefs({ playbackRate: speed });
  }, []);

  const skipSentences = useCallback(
    (delta: number) => {
      const list = sentencesRef.current;
      if (list.length === 0) return;
      const base = currentIndexRef.current >= 0 ? currentIndexRef.current : 0;
      seekTo(base + delta);
    },
    [seekTo],
  );

  const seekProgressBar = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const list = sentencesRef.current;
      if (list.length === 0) return;
      const rect = progressTrackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const max = list.length - 1;
      const idx = max <= 0 ? 0 : Math.round(pct * max);
      seekTo(idx);
    },
    [seekTo],
  );

  const sliderMax = Math.max(0, sentences.length - 1);
  const sliderValue = currentIndex < 0 ? 0 : Math.min(currentIndex, sliderMax);
  const progressPct = sentences.length <= 1 ? (currentIndex >= 0 ? 100 : 0) : (sliderValue / sliderMax) * 100;

  const displaySentence = sentences.length === 0 ? 0 : sliderValue + 1;
  const timerPct =
    sleepTimer > 0 && sleepTimeLeft != null && sleepTimeLeft > 0
      ? (sleepTimeLeft / (sleepTimer * 60)) * 100
      : 0;

  const volumePercent = Math.round(volume * 100);

  const showChapterNavControls =
    typeof onGoToPreviousChapter === "function" && typeof onGoToNextChapter === "function";

  return (
    <div
      className={`w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      <div className="px-5 py-4">
        <div className="mb-4 h-20 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
          <div className="h-full overflow-y-auto overscroll-contain px-3 py-2.5 [scrollbar-gutter:stable]">
            <p className="text-left text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              {currentIndex >= 0 && sentences[currentIndex]
                ? sentences[currentIndex]
                : sentences.length > 0
                  ? "Chọn Phát hoặc bấm một câu trong bài để bắt đầu."
                  : "Không có nội dung để đọc."}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              Câu {displaySentence}
              {sentences.length > 0 ? ` / ${sentences.length}` : ""}
            </span>
            <span className="tabular-nums">{rate}×</span>
            <span>
              {sentences.length > 1
                ? `Còn ${Math.max(0, sentences.length - sliderValue - 1)} câu`
                : ""}
            </span>
          </div>
          <div
            ref={progressTrackRef}
            onClick={seekProgressBar}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
              }
            }}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPct)}
            tabIndex={0}
            className="relative h-1.5 cursor-pointer rounded-full border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 transition-[width] duration-300 dark:from-indigo-400 dark:via-violet-500 dark:to-sky-400"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-500 bg-white shadow-sm ring-1 ring-indigo-500/30 transition-[left] duration-300 dark:border-violet-400 dark:bg-gray-900 dark:ring-violet-400/25"
              style={{ left: `${progressPct}%` }}
            />
          </div>
        </div>

        <div
          className={`mb-4 flex items-center justify-center ${showChapterNavControls ? "gap-2 sm:gap-2.5" : "gap-4"}`}
        >
          {showChapterNavControls ? (
            <button
              type="button"
              onClick={onGoToPreviousChapter}
              disabled={!canGoToPreviousChapter}
              aria-label="Chương trước"
              title="Chương trước"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-200/80 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-800/80 dark:bg-gray-800 dark:text-indigo-300 dark:hover:from-indigo-950/50 dark:hover:to-violet-950/40"
            >
              <ChapterNavPrevIcon />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => skipSentences(-1)}
            disabled={sentences.length === 0}
            aria-label="Câu trước"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200/80 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-800/80 dark:bg-gray-800 dark:text-indigo-300 dark:hover:from-indigo-950/50 dark:hover:to-violet-950/40"
          >
            <SkipBackIcon />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={sentences.length === 0}
            aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none dark:from-indigo-500 dark:to-violet-600 dark:shadow-indigo-900/50"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            type="button"
            onClick={() => skipSentences(1)}
            disabled={sentences.length === 0}
            aria-label="Câu sau"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200/80 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-800/80 dark:bg-gray-800 dark:text-indigo-300 dark:hover:from-indigo-950/50 dark:hover:to-violet-950/40"
          >
            <SkipForwardIcon />
          </button>
          {showChapterNavControls ? (
            <button
              type="button"
              onClick={onGoToNextChapter}
              disabled={!canGoToNextChapter}
              aria-label="Chương sau"
              title="Chương sau"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-200/80 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-800/80 dark:bg-gray-800 dark:text-indigo-300 dark:hover:from-indigo-950/50 dark:hover:to-violet-950/40"
            >
              <ChapterNavNextIcon />
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Âm lượng
              </span>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{volumePercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              aria-label="Âm lượng"
              className="w-full accent-indigo-600 dark:accent-violet-400"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Tốc độ
              </span>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{rate}×</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSpeedPick(s)}
                  className={chipClass(rate === s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Hẹn giờ tắt
              </span>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-100">
                {sleepTimer > 0 ? `${sleepTimer} phút` : "Tắt"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {SLEEP_OPTIONS.map((t) => (
                <button
                  key={t.minutes}
                  type="button"
                  onClick={() => setSleepTimer(t.minutes)}
                  className={chipClass(sleepTimer === t.minutes)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Còn lại
              </span>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-100">
                {sleepTimer > 0 && sleepTimeLeft != null && sleepTimeLeft > 0
                  ? formatSleepTime(sleepTimeLeft)
                  : "--:--"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-1000 dark:from-indigo-400 dark:to-violet-400"
                style={{ width: `${timerPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
              {sleepTimer > 0 ? "Tự động tắt sau khi hết giờ" : "Không hẹn giờ"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${
            isPlaying ? "animate-pulse bg-green-500" : "bg-gray-400 dark:bg-gray-500"
          }`}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isPlaying ? "Đang đọc…" : "Sẵn sàng"}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <select
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
            className="max-w-[min(11rem,42vw)] shrink rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            {langOptions.map((o) => (
              <option key={normalizeSpeechLang(o.value)} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {voiceList.length > 0 ? (
            <select
              aria-label="Chọn giọng đọc"
              className="max-w-[min(11rem,42vw)] shrink truncate rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
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
              <option value="">Mặc định</option>
              {voiceList.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI} title={`${v.name} (${v.lang})`}>
                  {v.name.length > 24 ? `${v.name.slice(0, 22)}…` : v.name}
                </option>
              ))}
            </select>
          ) : speechFallbackVoice ? (
            <span
              className="max-w-[min(14rem,48vw)] truncate text-xs text-amber-800 dark:text-amber-200/90"
              title="Máy chưa có giọng tiếng Việt; đang đọc bằng giọng hệ thống (phát âm tiếng Việt sẽ lạ). Cài gói ngôn ngữ hoặc chọn English trong «Ngôn ngữ đọc» nếu có giọng EN."
            >
              Giọng tạm:{" "}
              {speechFallbackVoice.name.length > 22
                ? `${speechFallbackVoice.name.slice(0, 20)}…`
                : speechFallbackVoice.name}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Không có giọng cho ngôn ngữ này</span>
          )}
        </div>
      </div>
    </div>
  );
});

AudioWeb.displayName = "AudioWeb";

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="11 18 6 12 11 6" />
      <polyline points="18 18 13 12 18 6" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="13 18 18 12 13 6" />
      <polyline points="6 18 11 12 6 6" />
    </svg>
  );
}

/** Hai mũi tên trái — chuyển chương (khác icon tua câu). */
function ChapterNavPrevIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11.25 19l-6.75-7 6.75-7M18 19l-6.75-7 6.75-7" />
    </svg>
  );
}

function ChapterNavNextIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.75 5l6.75 7-6.75 7M6 5l6.75 7-6.75 7" />
    </svg>
  );
}
