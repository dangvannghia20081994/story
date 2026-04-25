"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

function normalizeMediaDuration(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0 || raw === Number.POSITIVE_INFINITY) {
    return 0;
  }
  return raw;
}

export type AudioChapterItem = { id: number; title: string; audio_url: string | null };

interface AudioPlayerProps {
  src: string;
  title?: string;
  /** Tên truyện — hiển thị phụ khi layout="detail" */
  storyTitle?: string;
  chapters?: AudioChapterItem[];
  onChapterChange?: (chapterId: number) => void;
  /** Gộp vào card cha: bỏ viền/hộp mặc định */
  unstyled?: boolean;
  /** Trang chi tiết: giao diện player nổi bật */
  layout?: "default" | "detail";
  /** Chương khớp với `src` ban đầu (SSR) — highlight đúng pill */
  initialChapterId?: number | null;
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
  title,
  storyTitle,
  chapters = [],
  onChapterChange,
  unstyled,
  layout = "default",
  initialChapterId = null,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const sleepMenuRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [sleepTimeLeft, setSleepTimeLeft] = useState<number | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(initialChapterId);
  const [showChapterList, setShowChapterList] = useState(false);

  useEffect(() => {
    setCurrentChapterId(initialChapterId);
  }, [initialChapterId]);

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
  }, [src, syncDurationFromAudio]);

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
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [showSpeedMenu, showSleepMenu]);

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        void audioRef.current.play();
      }
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    syncDurationFromAudio();
  }, [syncDurationFromAudio]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

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
      if (chapter.audio_url && audioRef.current) {
        audioRef.current.src = chapter.audio_url;
        void audioRef.current.play();
        setCurrentChapterId(chapter.id);
        onChapterChange?.(chapter.id);
        setShowChapterList(false);
      }
    },
    [onChapterChange],
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
  /** Khi metadata chưa về, max phải ≥ currentTime để range controlled không bị kẹt. */
  const seekMax =
    safeDuration > 0 ? safeDuration : Math.max(1, Number.isFinite(currentTime) ? currentTime : 0);
  const pct = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  const shellClass =
    layout === "detail"
      ? "relative overflow-hidden rounded-2xl border border-indigo-200/40 bg-gradient-to-b from-indigo-50/90 via-white to-violet-50/50 shadow-[0_20px_50px_-20px_rgba(99,102,241,0.35)] dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-zinc-950 dark:to-violet-950/20"
      : unstyled
        ? "p-0"
        : "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className={shellClass}>
      {layout === "detail" ? (
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-600/15"
          aria-hidden
        />
      ) : null}
      {layout === "detail" ? (
        <div
          className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/10"
          aria-hidden
        />
      ) : null}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={syncDurationFromAudio}
      />

      {layout === "detail" ? (
        <div className="relative">
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500" aria-hidden />
          <div className="p-5 md:p-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600/90 dark:text-indigo-400">
                  Nghe audio
                </p>
                {isPlaying ? (
                  <span className="flex h-4 items-end gap-0.5" aria-hidden>
                    {[5, 12, 7, 14, 9].map((px, i) => (
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
              {storyTitle ? (
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{storyTitle}</p>
              ) : null}
              {title ? (
                <h3 className="text-balance text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-xl">
                  {title}
                </h3>
              ) : null}
            </div>
            {chapters.length > 1 ? (
              <span className="rounded-full border border-white/80 bg-white/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
                Chương {chapterIndex >= 0 ? chapterIndex + 1 : "—"} / {chapters.length}
              </span>
            ) : null}
          </div>

          {chapters.length > 0 ? (
            <div className="mb-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                Chọn chương
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-thin [scrollbar-width:thin]">
                {chapters.map((chapter, i) => {
                  const active = chapter.id === currentChapterId;
                  const disabled = !chapter.audio_url;
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
                      <span className="mt-0.5 line-clamp-2 max-w-[10rem]">{chapter.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mb-4">
            <div className="relative h-2.5 overflow-hidden rounded-full bg-zinc-200/90 dark:bg-zinc-800/90">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 transition-[width] duration-150 ease-out"
                style={{ width: `${pct}%` }}
              />
              <input
                type="range"
                min={0}
                max={seekMax}
                step={0.1}
                value={Math.min(currentTime, seekMax)}
                onChange={handleSeek}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Tiến độ phát"
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(safeDuration)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-white/70 transition hover:scale-[1.02] hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] dark:ring-zinc-900/80"
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            >
              {isPlaying ? (
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-xs">
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
                className="h-1.5 w-full min-w-[4rem] cursor-pointer accent-indigo-600 dark:accent-indigo-500"
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
                  className="rounded-xl border border-zinc-200/90 bg-white/90 px-3 py-2 text-xs font-bold tabular-nums text-zinc-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40"
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
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition ${
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
            </div>
          </div>
          </div>
        </div>
      ) : (
        <>
          {title && <h3 className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</h3>}

          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-zinc-500">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={seekMax}
              step={0.1}
              value={Math.min(currentTime, seekMax)}
              onChange={handleSeek}
              className="h-1 flex-1 cursor-pointer accent-zinc-600"
            />
            <span className="text-xs text-zinc-500">{formatTime(safeDuration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                aria-label={isPlaying ? "Tạm dừng" : "Phát"}
              >
                {isPlaying ? (
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
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => handleChapterSelect(chapter)}
                  disabled={!chapter.audio_url}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    currentChapterId === chapter.id
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  } ${!chapter.audio_url ? "opacity-50" : ""}`}
                >
                  <span className="truncate">{chapter.title}</span>
                  {chapter.audio_url ? (
                    <span className="text-xs text-green-600">✓</span>
                  ) : (
                    <span className="text-xs text-zinc-400">Chưa render</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
