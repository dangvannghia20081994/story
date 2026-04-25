"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface AudioPlayerProps {
  src: string;
  title?: string;
  chapters?: { id: number; title: string; audio_url: string | null }[];
  onChapterChange?: (chapterId: number) => void;
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

export function AudioPlayer({ src, title, chapters = [], onChapterChange }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [sleepTimeLeft, setSleepTimeLeft] = useState<number | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null);
  const [showChapterList, setShowChapterList] = useState(false);

  // Sleep timer effect
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

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

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

  const handleSleepTimer = useCallback((minutes: number) => {
    setSleepTimer(minutes);
  }, []);

  const handleChapterSelect = useCallback((chapter: { id: number; audio_url: string | null }) => {
    if (chapter.audio_url && audioRef.current) {
      audioRef.current.src = chapter.audio_url;
      audioRef.current.play();
      setCurrentChapterId(chapter.id);
      onChapterChange?.(chapter.id);
      setShowChapterList(false);
    }
  }, [onChapterChange]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSleepTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Title */}
      {title && (
        <h3 className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</h3>
      )}

      {/* Progress bar */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-zinc-500">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="h-1 flex-1 cursor-pointer accent-zinc-600"
        />
        <span className="text-xs text-zinc-500">{formatTime(duration)}</span>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            {isPlaying ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <svg className="h-4 w-4 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
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
            />
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Speed control */}
          <div className="relative">
            <button
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
                    onClick={() => handleSpeedChange(speed)}
                    className={`block w-full px-3 py-1 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                      playbackRate === speed ? "font-bold text-zinc-800 dark:text-zinc-200" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sleep timer */}
          <div className="relative">
            <button
              onClick={() => setSleepTimer((prev) => (prev > 0 ? 0 : 30))}
              className={`rounded px-2 py-1 text-xs font-medium ${
                sleepTimer > 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {sleepTimeLeft !== null ? formatSleepTime(sleepTimeLeft) : "⏰"}
            </button>
          </div>

          {/* Chapter list */}
          {chapters.length > 0 && (
            <button
              onClick={() => setShowChapterList(!showChapterList)}
              className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              📖 Chương ({chapters.length})
            </button>
          )}
        </div>
      </div>

      {/* Chapter list dropdown */}
      {showChapterList && chapters.length > 0 && (
        <div className="mt-3 max-h-60 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
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
    </div>
  );
}