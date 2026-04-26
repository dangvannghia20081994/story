"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";

import { useBrowserSpeechPlayback } from "@/hooks/useBrowserSpeechPlayback";
import {
  BROWSER_SPEECH_VOICE_URI_KEY,
  filterVietnameseVoices,
  logVietnameseVoiceAvailability,
} from "@/lib/browserSpeech";

function normalizeMediaDuration(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0 || raw === Number.POSITIVE_INFINITY) {
    return 0;
  }
  return raw;
}

export type AudioChapterItem = {
  id: number;
  title: string;
  audio_url: string | null;
  /** Nội dung chương — bật đọc bằng trình duyệt khi không có `audio_url`. */
  speech_text?: string | null;
};

interface AudioPlayerProps {
  src: string;
  /** Khi không có file audio: đọc bằng Web Speech API (tiếng Việt nếu trình duyệt có giọng). */
  speechText?: string | null;
  title?: string;
  /** Tên truyện — hiển thị phụ khi layout="detail" */
  storyTitle?: string;
  chapters?: AudioChapterItem[];
  onChapterChange?: (chapterId: number) => void;
  /** Gộp vào card cha: bỏ viền/hộp mặc định */
  unstyled?: boolean;
  /** Trang chi tiết / trang đọc: giao diện player nổi bật (`read` = dock dưới, gọn hơn) */
  layout?: "default" | "detail" | "read";
  /** Chương khớp với `src` ban đầu (SSR) — highlight đúng pill */
  initialChapterId?: number | null;
  /** Gọi khi đang phát (đã throttle) — ví dụ đồng bộ scroll nội dung */
  onPlaybackProgress?: (currentTime: number, duration: number, playing: boolean) => void;
  /** Sau khi seek xong (thả chuột / phím) — ví dụ cuộn bài đọn theo vị trí */
  onSeekComplete?: (currentTime: number, duration: number) => void;
  /** Giây từ backend khi `audio.duration` chưa sẵn sàng (trang đọc). */
  durationHintSec?: number | null;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const SLEEP_OPTIONS = [
  { label: "Tắt", minutes: 0 },
  { label: "15 phút", minutes: 15 },
  { label: "30 phút", minutes: 30 },
  { label: "45 phút", minutes: 45 },
  { label: "60 phút", minutes: 60 },
  { label: "90 phút", minutes: 90 },
];

export function AudioPlayer({
  src,
  speechText = null,
  title,
  storyTitle,
  chapters = [],
  onChapterChange,
  unstyled,
  layout = "default",
  initialChapterId = null,
  onPlaybackProgress,
  onSeekComplete,
  durationHintSec = null,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const sleepMenuRef = useRef<HTMLDivElement>(null);
  const readSettingsRef = useRef<HTMLDivElement>(null);
  const readSettingsPopoverRef = useRef<HTMLDivElement>(null);
  const [activeSrc, setActiveSrc] = useState(src);
  const onPlaybackProgressRef = useRef(onPlaybackProgress);
  const onSeekCompleteRef = useRef(onSeekComplete);
  const progressEmitAtRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showReadSettings, setShowReadSettings] = useState(false);
  const [readMenuPlacement, setReadMenuPlacement] = useState<{
    bottom: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [sleepTimeLeft, setSleepTimeLeft] = useState<number | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(initialChapterId);
  const [showChapterList, setShowChapterList] = useState(false);
  const [speechVoiceUri, setSpeechVoiceUri] = useState("");
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);

  const speechEnabled = useMemo(() => {
    const hasAudio = Boolean(src?.trim());
    return !hasAudio && Boolean(speechText?.trim());
  }, [src, speechText]);

  const viSpeechOptions = useMemo(() => filterVietnameseVoices(speechVoices), [speechVoices]);

  const speech = useBrowserSpeechPlayback({
    enabled: speechEnabled,
    text: speechText ?? "",
    rate: playbackRate,
    volume,
    voiceUri: speechVoiceUri,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BROWSER_SPEECH_VOICE_URI_KEY);
      if (raw) setSpeechVoiceUri(raw);
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
        setSpeechVoices(list);
      } catch {
        setSpeechVoices([]);
      }
    };
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", sync);
  }, []);

  useEffect(() => {
    if (!speechVoiceUri) return;
    if (viSpeechOptions.length === 0) return;
    if (!viSpeechOptions.some((v) => v.voiceURI === speechVoiceUri)) {
      setSpeechVoiceUri("");
      try {
        localStorage.removeItem(BROWSER_SPEECH_VOICE_URI_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [speechVoiceUri, viSpeechOptions]);

  useEffect(() => {
    speech.stop();
  }, [speechText, speech.stop]);

  const speechProgressEmitAtRef = useRef(0);
  useEffect(() => {
    if (!speechEnabled) return;
    const cb = onPlaybackProgressRef.current;
    if (!cb) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - speechProgressEmitAtRef.current < 240) return;
    speechProgressEmitAtRef.current = now;
    cb(speech.currentTime, speech.duration, speech.isSpeaking);
  }, [speechEnabled, speech.currentTime, speech.duration, speech.isSpeaking]);

  useEffect(() => {
    setCurrentChapterId(initialChapterId);
  }, [initialChapterId]);

  useEffect(() => {
    onPlaybackProgressRef.current = onPlaybackProgress;
  }, [onPlaybackProgress]);

  useEffect(() => {
    onSeekCompleteRef.current = onSeekComplete;
  }, [onSeekComplete]);

  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  const syncDurationFromAudio = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const d = normalizeMediaDuration(el.duration);
    if (d > 0) {
      setDuration(d);
    }
  }, []);

  /** Metadata có thể sẵn có (cache) trước khi onLoadedMetadata chạy — cần đọc lại sau mount / đổi src. */
  useLayoutEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    syncDurationFromAudio();

    const onMeta = () => syncDurationFromAudio();
    const onDur = () => syncDurationFromAudio();
    const onLoadedData = () => syncDurationFromAudio();

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onDur);
    el.addEventListener("loadeddata", onLoadedData);

    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onDur);
      el.removeEventListener("loadeddata", onLoadedData);
    };
  }, [activeSrc, syncDurationFromAudio]);

  useEffect(() => {
    if (sleepTimer <= 0) {
      setSleepTimeLeft(null);
      return;
    }

    setSleepTimeLeft(sleepTimer * 60);

    const interval = setInterval(() => {
      setSleepTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimer]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!(t instanceof Node)) return;
      if (showSpeedMenu && speedMenuRef.current && !speedMenuRef.current.contains(t)) {
        setShowSpeedMenu(false);
      }
      if (showSleepMenu && sleepMenuRef.current && !sleepMenuRef.current.contains(t)) {
        setShowSleepMenu(false);
      }
      if (showReadSettings) {
        const inReadTrigger = readSettingsRef.current?.contains(t) ?? false;
        const inReadPopover = readSettingsPopoverRef.current?.contains(t) ?? false;
        if (!inReadTrigger && !inReadPopover) {
          setShowReadSettings(false);
        }
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [showSpeedMenu, showSleepMenu, showReadSettings]);

  useLayoutEffect(() => {
    if (layout !== "read" || !showReadSettings) {
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
  }, [layout, showReadSettings]);

  const togglePlay = useCallback(() => {
    if (speechEnabled) {
      if (speech.isSpeaking) {
        speech.stop();
      } else {
        speech.speak();
      }
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, [speech, speechEnabled]);

  const hintD = normalizeMediaDuration(durationHintSec ?? 0);

  const emitSeekComplete = useCallback(() => {
    const el = audioRef.current;
    const cb = onSeekCompleteRef.current;
    if (!el || !cb) return;
    const fromEl = normalizeMediaDuration(el.duration);
    const fromState = normalizeMediaDuration(duration);
    const d = fromEl > 0 ? fromEl : fromState > 0 ? fromState : hintD;
    if (d <= 0) return;
    cb(el.currentTime, d);
  }, [duration, hintD]);

  /** Trong lúc `seeking`, một số trình duyệt vẫn bắn `timeupdate` với `currentTime` tạm (vd. 0) — không cập nhật UI. */
  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.seeking) return;
    const ct = el.currentTime;
    setCurrentTime(ct);
    const cb = onPlaybackProgressRef.current;
    if (!cb) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - progressEmitAtRef.current < 220) return;
    progressEmitAtRef.current = now;
    const d = normalizeMediaDuration(el.duration);
    cb(ct, d, !el.paused);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    syncDurationFromAudio();
  }, [syncDurationFromAudio]);

  const handleSeeked = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
  }, []);

  /** Seek theo vị trí click/kéo trên track (range ẩn hay trình duyệt hay bỏ qua click vào track). */
  const seekFromClientX = useCallback((clientX: number, track: HTMLElement) => {
    if (speechEnabled) return;
    const el = audioRef.current;
    if (!el) return;
    const fromEl = normalizeMediaDuration(el.duration);
    const fromState = normalizeMediaDuration(duration);
    const d = fromEl > 0 ? fromEl : fromState > 0 ? fromState : hintD;
    if (d <= 0) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time = ratio * d;
    el.currentTime = time;
    setCurrentTime(time);
  }, [duration, hintD, speechEnabled]);

  const onSeekTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      seekFromClientX(e.clientX, e.currentTarget);
    },
    [seekFromClientX],
  );

  const onSeekTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      seekFromClientX(e.clientX, e.currentTarget);
    },
    [seekFromClientX],
  );

  const onSeekTrackPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      emitSeekComplete();
    },
    [emitSeekComplete],
  );

  const onSeekTrackKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (speechEnabled) return;
      const el = audioRef.current;
      if (!el) return;
      const fromEl = normalizeMediaDuration(el.duration);
      const fromState = normalizeMediaDuration(duration);
      const d = fromEl > 0 ? fromEl : fromState > 0 ? fromState : hintD;
      if (d <= 0) return;
      const step = e.shiftKey ? 30 : 5;
      let next = el.currentTime;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        next = Math.max(0, next - step);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        next = Math.min(d, next + step);
      } else if (e.key === "Home") {
        e.preventDefault();
        next = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        next = d;
      } else {
        return;
      }
      el.currentTime = next;
      setCurrentTime(next);
      emitSeekComplete();
    },
    [duration, emitSeekComplete, hintD, speechEnabled],
  );

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  }, []);

  const handleChapterSelect = useCallback(
    (chapter: AudioChapterItem) => {
      const canAudio = Boolean(chapter.audio_url?.trim());
      const canSpeech = Boolean(chapter.speech_text?.trim());
      if (!canAudio && !canSpeech) return;
      speech.stop();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setActiveSrc(chapter.audio_url?.trim() ? chapter.audio_url : "");
      setCurrentChapterId(chapter.id);
      onChapterChange?.(chapter.id);
      setShowChapterList(false);
    },
    [onChapterChange, speech],
  );

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSleepTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const chapterIndex = chapters.findIndex((c) => c.id === currentChapterId);
  const safeDuration = normalizeMediaDuration(duration);
  const speechDurationUI = normalizeMediaDuration(speech.duration);
  const speechCurrentUI = normalizeMediaDuration(speech.currentTime);
  const uiDuration = speechEnabled ? speechDurationUI : safeDuration;
  const uiCurrentTime = speechEnabled ? speechCurrentUI : currentTime;
  const uiPlaying = speechEnabled ? speech.isSpeaking : isPlaying;
  /** Khi metadata chưa về, max phải ≥ currentTime để range controlled không bị kẹt. */
  const seekMax =
    uiDuration > 0 ? uiDuration : Math.max(1, Number.isFinite(uiCurrentTime) ? uiCurrentTime : 0);
  const pct = uiDuration > 0 ? Math.min(100, (uiCurrentTime / uiDuration) * 100) : 0;

  const premiumShell =
    "relative overflow-hidden border border-indigo-200/40 bg-gradient-to-b from-indigo-50/90 via-white to-violet-50/50 shadow-[0_20px_50px_-20px_rgba(99,102,241,0.35)] dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-zinc-950 dark:to-violet-950/20";
  /** Trang đọc: dock gọn, bớt đổ bóng để tiết kiệm không gian. */
  /** `overflow-visible` để menu cài đặt (`bottom-full`) không bị cắt bởi vỏ dock. */
  const readDockShell =
    "relative overflow-visible border border-indigo-200/35 bg-gradient-to-b from-indigo-50/80 via-white to-violet-50/40 shadow-[0_10px_28px_-16px_rgba(99,102,241,0.22)] dark:border-indigo-900/35 dark:from-indigo-950/35 dark:via-zinc-950 dark:to-violet-950/15";
  const shellClass =
    layout === "detail"
      ? `${premiumShell} rounded-2xl`
      : layout === "read"
        ? `${readDockShell} rounded-t-2xl rounded-b-none border-b-0`
        : unstyled
          ? "p-0"
          : "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900";

  const readCompact = layout === "read";
  const showPremiumLayout = layout === "detail" || layout === "read";

  return (
    <div className={shellClass}>
      {showPremiumLayout ? (
        <div
          className={`pointer-events-none absolute rounded-full blur-3xl ${
            readCompact
              ? "-right-10 -top-10 h-28 w-28 bg-violet-400/15 dark:bg-violet-600/12"
              : "-right-16 -top-16 h-48 w-48 bg-violet-400/20 dark:bg-violet-600/15"
          }`}
          aria-hidden
        />
      ) : null}
      {showPremiumLayout ? (
        <div
          className={`pointer-events-none absolute rounded-full blur-3xl ${
            readCompact
              ? "-bottom-8 -left-8 h-24 w-24 bg-indigo-400/12 dark:bg-indigo-500/8"
              : "-bottom-12 -left-12 h-40 w-40 bg-indigo-400/15 dark:bg-indigo-500/10"
          }`}
          aria-hidden
        />
      ) : null}

      <audio
        ref={audioRef}
        src={activeSrc?.trim() ? activeSrc : undefined}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onSeeked={handleSeeked}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={syncDurationFromAudio}
      />

      {showPremiumLayout ? (
        <div className="relative z-10">
          <div
            className={`w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 ${readCompact ? "h-0.5" : "h-1"}`}
            aria-hidden
          />
          <div
            className={
              readCompact ? "px-3 py-1 sm:px-6 sm:py-1.5 md:px-8 md:py-2" : "p-5 md:p-7"
            }
          >
          <div className={`flex flex-wrap items-start justify-between gap-2 sm:gap-3 ${readCompact ? "mb-1" : "mb-5"}`}>
            <div className={`min-w-0 flex-1 ${readCompact ? "space-y-0" : "space-y-1"}`}>
              <div className={`flex flex-wrap items-center ${readCompact ? "gap-1.5" : "gap-3"}`}>
                <p
                  className={`font-bold uppercase text-indigo-600/90 dark:text-indigo-400 ${
                    readCompact ? "text-[10px] tracking-[0.12em]" : "text-[11px] tracking-[0.2em]"
                  }`}
                >
                  {speechEnabled
                    ? readCompact
                      ? "Đọc trình duyệt"
                      : "Đọc bằng trình duyệt"
                    : readCompact
                      ? "Đang nghe"
                      : "Nghe audio"}
                </p>
                {uiPlaying ? (
                  <span className={`flex items-end gap-0.5 ${readCompact ? "h-2.5" : "h-4"}`} aria-hidden>
                    {(readCompact ? [2, 6, 4, 8, 5] : [5, 12, 7, 14, 9]).map((px, i) => (
                      <span
                        key={i}
                        className="w-0.5 rounded-full bg-gradient-to-t from-indigo-600 to-violet-400 motion-safe:animate-pulse dark:from-indigo-400 dark:to-violet-300"
                        style={{
                          height: `${px}px`,
                          animationDelay: `${i * 150}ms`,
                        }}
                      />
                    ))}
                  </span>
                ) : null}
              </div>
              {storyTitle && !readCompact ? (
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{storyTitle}</p>
              ) : null}
              {title && !readCompact ? (
                <h3
                  className={`text-balance font-bold tracking-tight text-zinc-900 dark:text-zinc-50 ${
                    readCompact ? "text-base md:text-lg" : "text-lg md:text-xl"
                  }`}
                >
                  {title}
                </h3>
              ) : null}
            </div>
            {chapters.length > 1 ? (
              <span
                className={`shrink-0 self-center rounded-full border border-white/80 bg-white/60 font-semibold tabular-nums text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 ${
                  readCompact ? "px-2 py-0.5 text-[9px] leading-none" : "px-2.5 py-1 text-[11px]"
                }`}
              >
                Chương {chapterIndex >= 0 ? chapterIndex + 1 : "—"} / {chapters.length}
              </span>
            ) : null}
          </div>

          {chapters.length > 0 && !readCompact ? (
            <div className="mb-5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                Chọn chương
              </p>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin [scrollbar-width:thin] sm:gap-2">
                {chapters.map((chapter, i) => {
                  const active = chapter.id === currentChapterId;
                  const canPlay =
                    Boolean(chapter.audio_url?.trim()) || Boolean(chapter.speech_text?.trim());
                  const disabled = !canPlay;
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleChapterSelect(chapter)}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${
                        disabled
                          ? "cursor-not-allowed border-zinc-200/80 bg-zinc-100/50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-600"
                          : active
                            ? "border-indigo-400 bg-indigo-600 text-white shadow-md shadow-indigo-500/25 dark:border-indigo-500 dark:bg-indigo-600"
                            : "border-zinc-200/90 bg-white/80 text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50/80 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
                      }`}
                    >
                      <span className="block tabular-nums opacity-80">{i + 1}</span>
                      <span className="mt-0.5 line-clamp-2 max-w-[10rem] font-medium">{chapter.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={readCompact ? "mb-1" : "mb-4"}>
            {readCompact ? (
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 font-mono text-[9px] tabular-nums leading-none text-zinc-500 dark:text-zinc-500">
                  {formatTime(uiCurrentTime)}
                </span>
                <div
                  role="slider"
                  tabIndex={0}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(0, Math.floor(seekMax))}
                  aria-valuenow={Math.min(Math.floor(uiCurrentTime), Math.floor(seekMax))}
                  aria-label="Tiến độ phát"
                  className={`relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200/90 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-zinc-800/90 dark:ring-offset-zinc-900 ${
                    speechEnabled ? "pointer-events-none cursor-default opacity-95" : "cursor-pointer"
                  }`}
                  onPointerDown={onSeekTrackPointerDown}
                  onPointerMove={onSeekTrackPointerMove}
                  onPointerUp={onSeekTrackPointerUp}
                  onPointerCancel={onSeekTrackPointerUp}
                  onKeyDown={onSeekTrackKeyDown}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 transition-[width] duration-150 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right font-mono text-[9px] tabular-nums leading-none text-zinc-500 dark:text-zinc-500">
                  {formatTime(uiDuration)}
                </span>
              </div>
            ) : (
              <>
                <div
                  role="slider"
                  tabIndex={0}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(0, Math.floor(seekMax))}
                  aria-valuenow={Math.min(Math.floor(uiCurrentTime), Math.floor(seekMax))}
                  aria-label="Tiến độ phát"
                  className={`relative h-2.5 overflow-hidden rounded-full bg-zinc-200/90 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-zinc-800/90 dark:ring-offset-zinc-900 ${
                    speechEnabled ? "pointer-events-none cursor-default opacity-95" : "cursor-pointer"
                  }`}
                  onPointerDown={onSeekTrackPointerDown}
                  onPointerMove={onSeekTrackPointerMove}
                  onPointerUp={onSeekTrackPointerUp}
                  onPointerCancel={onSeekTrackPointerUp}
                  onKeyDown={onSeekTrackKeyDown}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 transition-[width] duration-150 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-500">
                  <span>{formatTime(uiCurrentTime)}</span>
                  <span>{formatTime(uiDuration)}</span>
                </div>
              </>
            )}
            {speechEnabled ? (
              <p
                className={`text-zinc-400 dark:text-zinc-500 ${readCompact ? "mt-0.5 text-[8px] leading-tight" : "mt-1 text-[10px]"}`}
              >
                Thanh tiến độ là ước lượng; không tua được khi đọc trình duyệt.
              </p>
            ) : null}
          </div>

          <div
            className={`flex min-w-0 items-center ${readCompact ? "justify-between gap-2" : "flex-wrap gap-2 sm:gap-3"}`}
          >
            <button
              type="button"
              onClick={togglePlay}
              className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-500/30 transition hover:scale-[1.02] hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] dark:ring-zinc-900/80 ${
                readCompact
                  ? "h-8 w-8 shadow-md ring-2 ring-white/60 dark:ring-zinc-900/70"
                  : "h-14 w-14 shadow-lg ring-4 ring-white/70"
              }`}
              aria-label={uiPlaying ? "Tạm dừng" : "Phát"}
            >
              {uiPlaying ? (
                <svg className={readCompact ? "h-3.5 w-3.5" : "h-6 w-6"} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className={readCompact ? "ml-0.5 h-4 w-4" : "ml-1 h-7 w-7"} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {readCompact ? (
              <div className="relative shrink-0" ref={readSettingsRef}>
                <button
                  type="button"
                  aria-expanded={showReadSettings}
                  aria-haspopup="true"
                  aria-label="Cài đặt phát"
                  title="Cài đặt"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReadSettings((v) => !v);
                    setShowSpeedMenu(false);
                    setShowSleepMenu(false);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200/90 bg-white/90 text-zinc-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-800 dark:border-zinc-600 dark:bg-zinc-900/85 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200 ${
                    sleepTimer > 0 || playbackRate !== 1
                      ? "ring-2 ring-indigo-400/35 dark:ring-indigo-500/30"
                      : ""
                  }`}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border border-zinc-200/85 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-zinc-700/85 dark:bg-zinc-900/75">
                <div className="flex min-w-0 flex-[1_1_8rem] items-center gap-2 sm:flex-[1_1_12rem]">
                  <span className="shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
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
                    className="h-1.5 min-w-0 flex-1 cursor-pointer accent-indigo-600 dark:accent-indigo-500"
                    aria-label="Âm lượng"
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="relative" ref={speedMenuRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSpeedMenu((v) => !v);
                        setShowSleepMenu(false);
                      }}
                      className="rounded-lg border border-zinc-200/90 bg-white/90 px-3 py-2 text-xs font-bold tabular-nums text-zinc-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40"
                    >
                      {playbackRate}x
                    </button>
                    {showSpeedMenu ? (
                      <div
                        className="absolute bottom-full right-0 z-10 mb-2 min-w-[5.5rem] overflow-hidden rounded-xl border border-zinc-200/90 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {SPEED_OPTIONS.map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => handleSpeedChange(speed)}
                            className={`block w-full px-3 py-2 text-left text-xs font-medium tabular-nums hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                              playbackRate === speed
                                ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200"
                                : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="relative" ref={sleepMenuRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSleepMenu((v) => !v);
                        setShowSpeedMenu(false);
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition ${
                        sleepTimer > 0
                          ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                          : "border-zinc-200/90 bg-white/90 text-zinc-700 hover:border-indigo-200 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200"
                      }`}
                      title="Hẹn giờ tắt"
                    >
                      {sleepTimeLeft !== null && sleepTimeLeft > 0 ? formatSleepTime(sleepTimeLeft) : "⏰"}
                    </button>
                    {showSleepMenu ? (
                      <div
                        className="absolute bottom-full right-0 z-10 mb-2 w-44 overflow-hidden rounded-xl border border-zinc-200/90 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {SLEEP_OPTIONS.map((opt) => (
                          <button
                            key={opt.minutes}
                            type="button"
                            onClick={() => {
                              setSleepTimer(opt.minutes);
                              setShowSleepMenu(false);
                            }}
                            className={`block w-full px-3 py-2 text-left text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                              sleepTimer === opt.minutes
                                ? "text-indigo-700 dark:text-indigo-300"
                                : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {speechEnabled && viSpeechOptions.length > 0 ? (
                    <select
                      aria-label="Giọng đọc trình duyệt"
                      title="Giọng đọc trình duyệt"
                      className="max-w-[9rem] shrink-0 cursor-pointer truncate rounded-md border border-zinc-200/90 bg-white py-1 pl-1.5 pr-7 text-xs font-medium text-zinc-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                      value={speechVoiceUri}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSpeechVoiceUri(v);
                        try {
                          if (v) localStorage.setItem(BROWSER_SPEECH_VOICE_URI_KEY, v);
                          else localStorage.removeItem(BROWSER_SPEECH_VOICE_URI_KEY);
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      <option value="">Mặc định (tiếng Việt)</option>
                      {viSpeechOptions.map((v) => {
                        const label = v.name.length > 22 ? `${v.name.slice(0, 20)}…` : v.name;
                        return (
                          <option key={v.voiceURI} value={v.voiceURI} title={`${v.name} (${v.lang})`}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  ) : null}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      ) : (
        <>
          {title && <h3 className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</h3>}

          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-zinc-500">{formatTime(uiCurrentTime)}</span>
            <div
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={Math.max(0, Math.floor(seekMax))}
              aria-valuenow={Math.min(Math.floor(uiCurrentTime), Math.floor(seekMax))}
              aria-label="Tiến độ phát"
              className={`relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-zinc-500 dark:bg-zinc-700 dark:ring-offset-zinc-900 ${
                speechEnabled ? "pointer-events-none cursor-default opacity-90" : "cursor-pointer"
              }`}
              onPointerDown={onSeekTrackPointerDown}
              onPointerMove={onSeekTrackPointerMove}
              onPointerUp={onSeekTrackPointerUp}
              onPointerCancel={onSeekTrackPointerUp}
              onKeyDown={onSeekTrackKeyDown}
            >
              <div
                className="pointer-events-none absolute inset-y-0 left-0 bg-zinc-600 dark:bg-zinc-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500">{formatTime(uiDuration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                aria-label={uiPlaying ? "Tạm dừng" : "Phát"}
              >
                {uiPlaying ? (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <div className="flex items-center gap-1">
                <svg className="h-4 w-4 text-zinc-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-20 cursor-pointer accent-zinc-600"
                  aria-label="Âm lượng"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative" ref={speedMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-1 rounded border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                    {SPEED_OPTIONS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => handleSpeedChange(speed)}
                        className={`block w-full px-3 py-1 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                          playbackRate === speed
                            ? "font-bold text-zinc-800 dark:text-zinc-200"
                            : "text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSleepTimer((prev) => (prev > 0 ? 0 : 30))}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    sleepTimer > 0
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {sleepTimeLeft !== null ? formatSleepTime(sleepTimeLeft) : "⏰"}
                </button>
              </div>

              {chapters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowChapterList(!showChapterList)}
                  className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  📖 Chương ({chapters.length})
                </button>
              )}
            </div>
          </div>

          {showChapterList && chapters.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700">
              {chapters.map((chapter) => {
                const can = Boolean(chapter.audio_url?.trim()) || Boolean(chapter.speech_text?.trim());
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => handleChapterSelect(chapter)}
                    disabled={!can}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      currentChapterId === chapter.id
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    } ${!can ? "opacity-50" : ""}`}
                  >
                    <span className="truncate">{chapter.title}</span>
                    {chapter.audio_url?.trim() ? (
                      <span className="text-xs text-green-600">✓</span>
                    ) : can ? (
                      <span className="text-xs text-sky-600 dark:text-sky-400">Trình duyệt</span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {readCompact && showReadSettings && readMenuPlacement && typeof document !== "undefined"
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
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Tốc độ
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSpeedChange(speed)}
                      className={`rounded-lg border px-1 py-1.5 text-center text-[10px] font-bold tabular-nums transition ${
                        playbackRate === speed
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
                      onClick={() => {
                        setSleepTimer(opt.minutes);
                      }}
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
              {speechEnabled && viSpeechOptions.length > 0 ? (
                <div>
                  <label
                    htmlFor="read-audio-voice"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    Giọng đọc
                  </label>
                  <select
                    id="read-audio-voice"
                    aria-label="Giọng đọc trình duyệt"
                    title="Giọng đọc trình duyệt"
                    className="w-full max-w-full cursor-pointer truncate rounded-lg border border-zinc-200/90 bg-white py-1.5 pl-2 pr-8 text-xs font-medium text-zinc-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    value={speechVoiceUri}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSpeechVoiceUri(v);
                      try {
                        if (v) localStorage.setItem(BROWSER_SPEECH_VOICE_URI_KEY, v);
                        else localStorage.removeItem(BROWSER_SPEECH_VOICE_URI_KEY);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <option value="">Mặc định (tiếng Việt)</option>
                    {viSpeechOptions.map((v) => {
                      const label = v.name.length > 28 ? `${v.name.slice(0, 26)}…` : v.name;
                      return (
                        <option key={v.voiceURI} value={v.voiceURI} title={`${v.name} (${v.lang})`}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
