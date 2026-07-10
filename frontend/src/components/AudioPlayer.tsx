"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";

import { useBrowserSpeechPlayback } from "@/hooks/useBrowserSpeechPlayback";
import {
  BROWSER_SPEECH_VOICE_URI_KEY,
  filterVietnameseVoices,
  logVietnameseVoiceAvailability,
} from "@/lib/browserSpeech";
import { loadAudioReadPrefs, saveAudioReadPrefs } from "@/lib/audioReadPreferences";
import { STORY_AUDIOREAD_SLEEP_ENDED, useAudioReadSleep } from "@/contexts/AudioReadSleepContext";

function normalizeMediaDuration(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0 || raw === Number.POSITIVE_INFINITY) {
    return 0;
  }
  return raw;
}

export type AudioChapterItem = {
  id: number;
  title: string;
  audio_single_url: string | null;
  /** Nội dung chương — bật đọc bằng trình duyệt khi không có `audio_single_url`. */
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
  /** Trang chi tiết / trang đọc: giao diện player nổi bật (`read` = dock dưới, gọn hơn). `audioweb` = giống khối AudioWeb (file MP3). */
  layout?: "default" | "detail" | "read" | "audioweb";
  /** Chương khớp với `src` ban đầu (SSR) — highlight đúng pill */
  initialChapterId?: number | null;
  /** Gọi khi đang phát (đã throttle) — ví dụ đồng bộ scroll nội dung */
  onPlaybackProgress?: (currentTime: number, duration: number, playing: boolean) => void;
  /** Sau khi seek xong (thả chuột / phím) — ví dụ cuộn bài đọn theo vị trí */
  onSeekComplete?: (currentTime: number, duration: number) => void;
  /** Giây từ backend khi `audio.duration` chưa sẵn sàng (trang đọc). */
  durationHintSec?: number | null;
  /**
   * Chương kế tiếp khi phát hết file (layout read): gọi `onChapterChange` rồi thử `play()` khi file mới sẵn sàng.
   * Trình duyệt có thể chặn (autoplay policy). Không dùng khi đọc bằng giọng trình duyệt (`speechEnabled`).
   */
  autoAdvanceChapter?: AudioChapterItem | null;
  /** Lưu/khôi phục vị trí file audio (giây) trong prefs trang đọc — ví dụ `story-audiofile:{storyId}:{chapterId}`. */
  audioPositionStorageKey?: string | null;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const SLEEP_OPTIONS = [
  { label: "Tắt", minutes: 0 },
  { label: "3 phút (thử)", minutes: 3 },
  { label: "15 phút", minutes: 15 },
  { label: "30 phút", minutes: 30 },
  { label: "45 phút", minutes: 45 },
  { label: "60 phút", minutes: 60 },
  { label: "90 phút", minutes: 90 },
];

function audiowebChipClass(active: boolean) {
  return `rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
    active
      ? "border-transparent bg-ngoc text-[#f6ede0] shadow-sm"
      : "border-line bg-paper-raised text-ink-soft hover:border-ngoc/40 hover:bg-ngoc/10"
  }`;
}

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
  autoAdvanceChapter = null,
  audioPositionStorageKey = null,
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
  const audioPositionStorageKeyRef = useRef<string | null>(null);
  const restoreAudioChapterMarkRef = useRef("");
  const lastAudioChapterSaveAtRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => loadAudioReadPrefs().volume);
  const [playbackRate, setPlaybackRate] = useState(() => loadAudioReadPrefs().playbackRate);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showReadSettings, setShowReadSettings] = useState(false);
  const [readMenuPlacement, setReadMenuPlacement] = useState<{
    bottom: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const { sleepTimer, sleepTimeLeft, setSleepTimer } = useAudioReadSleep();
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(initialChapterId);
  /** Chỉ bật khi vừa hết file và chuyển chương kế — dùng với `canplay` để gọi `play()` (Chrome có thể chặn nếu không còn tương tác). */
  const autoplayAfterSrcChangeRef = useRef(false);
  const [autoplayBlockedMessage, setAutoplayBlockedMessage] = useState<string | null>(null);
  const autoAdvanceChapterRef = useRef(autoAdvanceChapter);
  autoAdvanceChapterRef.current = autoAdvanceChapter;
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
    audioPositionStorageKeyRef.current = audioPositionStorageKey?.trim() || null;
  }, [audioPositionStorageKey]);

  /** Khôi phục vị trí file audio từ prefs (sau khi có duration). */
  useEffect(() => {
    if (speechEnabled || !audioPositionStorageKey?.trim()) return;
    const key = audioPositionStorageKey.trim();
    const el = audioRef.current;
    if (!el) return;
    const mark = `${activeSrc}|${key}`;
    restoreAudioChapterMarkRef.current = "";

    const tryRestore = () => {
      if (restoreAudioChapterMarkRef.current === mark) return;
      const d = normalizeMediaDuration(el.duration);
      if (d <= 0) return;
      const tSaved = loadAudioReadPrefs().chapterAudioSec[key];
      if (!Number.isFinite(tSaved) || tSaved < 0.25) return;
      const t = Math.min(tSaved, d - 0.25);
      el.currentTime = t;
      setCurrentTime(t);
      restoreAudioChapterMarkRef.current = mark;
    };

    el.addEventListener("loadedmetadata", tryRestore);
    el.addEventListener("durationchange", tryRestore);
    queueMicrotask(tryRestore);

    return () => {
      el.removeEventListener("loadedmetadata", tryRestore);
      el.removeEventListener("durationchange", tryRestore);
    };
  }, [activeSrc, audioPositionStorageKey, speechEnabled]);

  /** Ghi vị trí khi tạm dừng / seek (bổ sung cho throttle timeupdate). */
  useEffect(() => {
    if (speechEnabled || !audioPositionStorageKey?.trim()) return;
    const key = audioPositionStorageKey.trim();
    const el = audioRef.current;
    if (!el) return;

    const flush = () => {
      const d = normalizeMediaDuration(el.duration);
      const ct = el.currentTime;
      if (d <= 0 || ct < 0.5 || ct >= d - 0.35) return;
      saveAudioReadPrefs({ chapterAudioSec: { [key]: Math.min(ct, d - 0.25) } });
    };

    el.addEventListener("pause", flush);
    el.addEventListener("seeked", flush);
    return () => {
      el.removeEventListener("pause", flush);
      el.removeEventListener("seeked", flush);
    };
  }, [speechEnabled, audioPositionStorageKey, activeSrc]);

  /**
   * Đồng bộ prop `src` vào state trong phase layout (trước các effect metadata/canplay).
   * Nếu dùng `useEffect`, một render `src` đã mới còn `activeSrc` cũ → `<audio>` và effect [activeSrc] lệch,
   * autoplay sau `ended` có thể không gắn listener / không gọi `play()` đúng lúc.
   */
  useLayoutEffect(() => {
    setActiveSrc(src);
  }, [src]);

  useLayoutEffect(() => {
    const el = audioRef.current;
    if (!el || speechEnabled) return;
    el.volume = volume;
    el.playbackRate = playbackRate;
  }, [activeSrc, volume, playbackRate, speechEnabled]);

  useEffect(() => {
    const onSleepEnded = () => {
      autoplayAfterSrcChangeRef.current = false;
      speech.stop();
      const el = audioRef.current;
      if (el) {
        try {
          el.pause();
        } catch {
          /* ignore */
        }
      }
      setIsPlaying(false);
    };
    window.addEventListener(STORY_AUDIOREAD_SLEEP_ENDED, onSleepEnded);
    return () => window.removeEventListener(STORY_AUDIOREAD_SLEEP_ENDED, onSleepEnded);
  }, [speech.stop]);

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

    setAutoplayBlockedMessage(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    syncDurationFromAudio();

    const onMeta = () => syncDurationFromAudio();
    const onDur = () => syncDurationFromAudio();
    const onLoadedData = () => syncDurationFromAudio();

    const playWhenReady = () => {
      if (!autoplayAfterSrcChangeRef.current) {
        return;
      }
      autoplayAfterSrcChangeRef.current = false;
      void el.play().catch((err: unknown) => {
        const name = err && typeof err === "object" && "name" in err ? (err as { name?: string }).name : "";
        if (name === "NotAllowedError") {
          setAutoplayBlockedMessage(
            "Trình duyệt chặn tự phát chương tiếp — bấm Phát để nghe (chính sách autoplay của Chrome/Safari).",
          );
        }
      });
    };

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onDur);
    el.addEventListener("loadeddata", onLoadedData);
    el.addEventListener("canplay", playWhenReady, { once: true });
    if (autoplayAfterSrcChangeRef.current && el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      queueMicrotask(playWhenReady);
    }

    /* cleanup; effect deps gồm `src` để parent đổi URL trước khi `activeSrc` khớp vẫn gắn lại canplay/autoplay. */
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onDur);
      el.removeEventListener("loadeddata", onLoadedData);
      el.removeEventListener("canplay", playWhenReady);
    };
  }, [activeSrc, src, syncDurationFromAudio]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || speechEnabled) {
      return;
    }
    const onEnded = () => {
      setIsPlaying(false);
      const posKey = audioPositionStorageKeyRef.current;
      if (posKey) {
        saveAudioReadPrefs({ removeChapterAudioSecKeys: [posKey] });
      }
      const adv = autoAdvanceChapterRef.current;
      const url = adv?.audio_single_url?.trim();
      if (!adv || !url) {
        return;
      }
      speech.stop();
      autoplayAfterSrcChangeRef.current = true;
      onChapterChange?.(adv.id);
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [onChapterChange, speechEnabled]);

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
      void el
        .play()
        .then(() => setAutoplayBlockedMessage(null))
        .catch(() => {});
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

  const skipAudioSeconds = useCallback(
    (delta: number) => {
      if (speechEnabled) return;
      const el = audioRef.current;
      if (!el) return;
      const fromEl = normalizeMediaDuration(el.duration);
      const fromState = normalizeMediaDuration(duration);
      const d = fromEl > 0 ? fromEl : fromState > 0 ? fromState : hintD;
      if (d <= 0) return;
      const next = Math.min(Math.max(0, el.currentTime + delta), d);
      el.currentTime = next;
      setCurrentTime(next);
      emitSeekComplete();
    },
    [duration, emitSeekComplete, hintD, speechEnabled],
  );

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

    const posKey = audioPositionStorageKeyRef.current;
    if (posKey && !el.paused && d > 0 && ct >= 0.5 && ct < d - 0.35) {
      if (now - lastAudioChapterSaveAtRef.current > 2500) {
        lastAudioChapterSaveAtRef.current = now;
        saveAudioReadPrefs({ chapterAudioSec: { [posKey]: Math.min(ct, d - 0.25) } });
      }
    }
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
    saveAudioReadPrefs({ volume: vol });
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackRate(speed);
    saveAudioReadPrefs({ playbackRate: speed });
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  }, []);

  const handleChapterSelect = useCallback(
    (chapter: AudioChapterItem) => {
      const canAudio = Boolean(chapter.audio_single_url?.trim());
      const canSpeech = Boolean(chapter.speech_text?.trim());
      if (!canAudio && !canSpeech) return;
      speech.stop();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setActiveSrc(chapter.audio_single_url?.trim() ? chapter.audio_single_url : "");
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

  const volumePercentAwb = Math.round(volume * 100);
  const remainAudioSec = Math.max(0, uiDuration - uiCurrentTime);
  const timerPctAwb =
    sleepTimer > 0 && sleepTimeLeft != null && sleepTimeLeft > 0
      ? (sleepTimeLeft / (sleepTimer * 60)) * 100
      : 0;

  const audiowebPrevChapter =
    chapterIndex > 0 ? chapters[chapterIndex - 1] : undefined;
  const audiowebNextChapter =
    chapterIndex >= 0 && chapterIndex < chapters.length - 1
      ? chapters[chapterIndex + 1]
      : undefined;
  const audiowebCanGoPrev = Boolean(
    audiowebPrevChapter &&
      (audiowebPrevChapter.audio_single_url?.trim() || audiowebPrevChapter.speech_text?.trim()),
  );
  const audiowebCanGoNext = Boolean(
    audiowebNextChapter &&
      (audiowebNextChapter.audio_single_url?.trim() || audiowebNextChapter.speech_text?.trim()),
  );
  const audiowebShowChapterNav = chapters.length > 1 && chapterIndex >= 0;

  const premiumShell =
    "relative overflow-hidden border border-line bg-paper-raised shadow-[0_20px_50px_-20px_rgba(46,125,107,0.3)]";
  /** Trang đọc: dock gọn, bớt đổ bóng để tiết kiệm không gian. */
  /** `overflow-visible` để menu cài đặt (`bottom-full`) không bị cắt bởi vỏ dock. */
  const readDockShell =
    "relative overflow-visible border border-line bg-paper-raised shadow-[0_10px_28px_-16px_rgba(46,125,107,0.2)]";
  const audiowebLayout = layout === "audioweb" && !speechEnabled;
  const audiowebShell = "relative w-full max-w-2xl overflow-hidden paper-card";
  const shellClass = audiowebLayout
    ? audiowebShell
    : layout === "detail"
      ? `${premiumShell} rounded-2xl`
      : layout === "read"
        ? `${readDockShell} rounded-t-2xl rounded-b-none border-b-0`
        : unstyled
          ? "p-0"
          : "rounded-lg border border-line bg-paper-raised p-4";

  const readCompact = layout === "read";
  const showPremiumLayout = layout === "detail" || layout === "read";

  return (
    <div className={shellClass}>
      {showPremiumLayout ? (
        <div
          className={`pointer-events-none absolute rounded-full blur-3xl ${
            readCompact
              ? "-right-10 -top-10 h-28 w-28 bg-ngoc/15"
              : "-right-16 -top-16 h-48 w-48 bg-ngoc/20"
          }`}
          aria-hidden
        />
      ) : null}
      {showPremiumLayout ? (
        <div
          className={`pointer-events-none absolute rounded-full blur-3xl ${
            readCompact
              ? "-bottom-8 -left-8 h-24 w-24 bg-chusa/12"
              : "-bottom-12 -left-12 h-40 w-40 bg-chusa/15"
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

      {audiowebLayout ? (
        <>
          <div className="relative z-10 px-4 py-3 sm:px-5 sm:py-4">
          {autoplayBlockedMessage ? (
            <p
              role="status"
              className="mb-3 text-center text-xs leading-snug text-chusa"
            >
              {autoplayBlockedMessage}
            </p>
          ) : null}

          <div className="mb-3 max-h-20 overflow-y-auto rounded-xl border border-line bg-paper-inset px-3 py-1.5 sm:max-h-24 sm:mb-4 sm:py-2">
            {storyTitle ? (
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                {storyTitle}
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-ink-soft">
              {title?.trim()
                ? title
                : "Đang phát file audio — dùng thanh trượt hoặc tua ±15 giây để tìm đoạn."}
            </p>
          </div>

          <div className="mb-3 sm:mb-4">
            <div className="mb-1.5 flex justify-between text-xs text-ink-faint">
              <span className="tabular-nums">
                {formatTime(uiCurrentTime)} / {formatTime(uiDuration)}
              </span>
              <span className="tabular-nums">{playbackRate}×</span>
              <span className="tabular-nums">Còn {formatTime(remainAudioSec)}</span>
            </div>
            <div
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={Math.max(0, Math.floor(seekMax))}
              aria-valuenow={Math.min(Math.floor(uiCurrentTime), Math.floor(seekMax))}
              aria-label="Tiến độ phát"
              className="relative h-1.5 cursor-pointer rounded-full border border-line bg-paper-inset outline-none"
              onPointerDown={onSeekTrackPointerDown}
              onPointerMove={onSeekTrackPointerMove}
              onPointerUp={onSeekTrackPointerUp}
              onPointerCancel={onSeekTrackPointerUp}
              onKeyDown={onSeekTrackKeyDown}
            >
              <div
                className="h-full rounded-full bg-ngoc transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ngoc bg-paper-raised shadow-sm ring-1 ring-ngoc/30 transition-[left] duration-150"
                style={{ left: `${pct}%` }}
              />
            </div>
          </div>

          <div
            className={`mb-3 flex items-center justify-center sm:mb-4 ${audiowebShowChapterNav ? "gap-2 sm:gap-2.5" : "gap-4"}`}
          >
            {audiowebShowChapterNav ? (
              <button
                type="button"
                onClick={() => audiowebPrevChapter && handleChapterSelect(audiowebPrevChapter)}
                disabled={!audiowebCanGoPrev}
                aria-label="Chương trước"
                title="Chương trước"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ngoc/25 bg-ngoc/10 text-ngoc shadow-sm transition hover:border-ngoc/50 hover:bg-ngoc/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <AudiowebChapterNavPrevIcon />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => skipAudioSeconds(-15)}
              aria-label="Lùi 15 giây"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ngoc/25 bg-ngoc/10 text-ngoc shadow-sm transition hover:border-ngoc/50 hover:bg-ngoc/15"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="11 18 6 12 11 6" />
                <polyline points="18 18 13 12 18 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={uiPlaying ? "Tạm dừng" : "Phát"}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ngoc text-[#f6ede0] shadow-lg shadow-ngoc/30 transition hover:bg-ngoc-deep active:scale-95"
            >
              {uiPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => skipAudioSeconds(15)}
              aria-label="Tiến 15 giây"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ngoc/25 bg-ngoc/10 text-ngoc shadow-sm transition hover:border-ngoc/50 hover:bg-ngoc/15"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="13 18 18 12 13 6" />
                <polyline points="6 18 11 12 6 6" />
              </svg>
            </button>
            {audiowebShowChapterNav ? (
              <button
                type="button"
                onClick={() => audiowebNextChapter && handleChapterSelect(audiowebNextChapter)}
                disabled={!audiowebCanGoNext}
                aria-label="Chương sau"
                title="Chương sau"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ngoc/25 bg-ngoc/10 text-ngoc shadow-sm transition hover:border-ngoc/50 hover:bg-ngoc/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <AudiowebChapterNavNextIcon />
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-paper-inset p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Âm lượng
                </span>
                <span className="text-xs font-medium text-ink">{volumePercentAwb}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={handleVolumeChange}
                aria-label="Âm lượng"
                className="w-full accent-ngoc"
              />
            </div>

            <div className="rounded-xl border border-line bg-paper-inset p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Tốc độ
                </span>
                <span className="text-xs font-medium text-ink">{playbackRate}×</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {SPEED_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => handleSpeedChange(s)} className={audiowebChipClass(playbackRate === s)}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-paper-inset p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Hẹn giờ tắt
                </span>
                <span className="text-xs font-medium text-ink">
                  {sleepTimer > 0 ? `${sleepTimer} phút` : "Tắt"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {SLEEP_OPTIONS.map((t) => (
                  <button
                    key={t.minutes}
                    type="button"
                    onClick={() => setSleepTimer(t.minutes)}
                    className={audiowebChipClass(sleepTimer === t.minutes)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-paper-inset p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Còn lại
                </span>
                <span className="text-xs font-medium text-ink">
                  {sleepTimer > 0 && sleepTimeLeft != null && sleepTimeLeft > 0 ? formatSleepTime(sleepTimeLeft) : "--:--"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-ngoc transition-[width] duration-1000"
                  style={{ width: `${timerPctAwb}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-ink-faint">
                {sleepTimer > 0 ? "Tự động tắt sau khi hết giờ" : "Không hẹn giờ"}
              </p>
            </div>
          </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2 border-t border-line bg-paper-inset px-5 py-3">
            <div
              className={`h-2 w-2 shrink-0 rounded-full ${uiPlaying ? "animate-pulse bg-ngoc" : "bg-ink-faint"}`}
            />
            <span className="text-xs text-ink-faint">
              {uiPlaying ? "Đang phát…" : "Sẵn sàng"}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              <span
                className="max-w-[min(11rem,42vw)] shrink truncate rounded-lg border border-line bg-paper-raised px-2 py-1 text-xs text-ink-faint"
                title="Nghe TTS và chọn ngôn ngữ/giọng ở trang Giọng trình duyệt"
              >
                Chỉ file âm thanh
              </span>
            </div>
          </div>
        </>
      ) : showPremiumLayout ? (
        <div className="relative z-10">
          <div
            className={`w-full bg-ngoc ${readCompact ? "h-0.5" : "h-1"}`}
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
                  className={`font-display font-bold uppercase text-ngoc ${
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
                        className="w-0.5 rounded-full bg-ngoc motion-safe:animate-pulse"
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
                <p className="text-xs font-medium text-ink-faint">{storyTitle}</p>
              ) : null}
              {title && !readCompact ? (
                <h3
                  className={`font-display font-bold tracking-tight text-ink ${
                    readCompact ? "text-base md:text-lg" : "text-lg md:text-xl"
                  }`}
                >
                  {title}
                </h3>
              ) : null}
            </div>
            {chapters.length > 1 ? (
              <span
                className={`shrink-0 self-center rounded-full border border-line bg-paper-raised font-semibold tabular-nums text-ink-soft shadow-sm ${
                  readCompact ? "px-2 py-0.5 text-[9px] leading-none" : "px-2.5 py-1 text-[11px]"
                }`}
              >
                Chương {chapterIndex >= 0 ? chapterIndex + 1 : "—"} / {chapters.length}
              </span>
            ) : null}
          </div>

          {chapters.length > 0 && !readCompact ? (
            <div className="mb-5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Chọn chương
              </p>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin [scrollbar-width:thin] sm:gap-2">
                {chapters.map((chapter, i) => {
                  const active = chapter.id === currentChapterId;
                  const canPlay =
                    Boolean(chapter.audio_single_url?.trim()) || Boolean(chapter.speech_text?.trim());
                  const disabled = !canPlay;
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleChapterSelect(chapter)}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${
                        disabled
                          ? "cursor-not-allowed border-line bg-paper-inset text-ink-faint"
                          : active
                            ? "border-ngoc bg-ngoc text-[#f6ede0] shadow-md shadow-ngoc/25"
                            : "border-line bg-paper-raised text-ink-soft hover:border-ngoc/40 hover:bg-ngoc/10"
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
                <span className="w-9 shrink-0 font-mono text-[9px] tabular-nums leading-none text-ink-faint">
                  {formatTime(uiCurrentTime)}
                </span>
                <div
                  role="slider"
                  tabIndex={0}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(0, Math.floor(seekMax))}
                  aria-valuenow={Math.min(Math.floor(uiCurrentTime), Math.floor(seekMax))}
                  aria-label="Tiến độ phát"
                  className={`relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-paper-inset outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ngoc ${
                    speechEnabled ? "pointer-events-none cursor-default opacity-95" : "cursor-pointer"
                  }`}
                  onPointerDown={onSeekTrackPointerDown}
                  onPointerMove={onSeekTrackPointerMove}
                  onPointerUp={onSeekTrackPointerUp}
                  onPointerCancel={onSeekTrackPointerUp}
                  onKeyDown={onSeekTrackKeyDown}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-ngoc transition-[width] duration-150 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right font-mono text-[9px] tabular-nums leading-none text-ink-faint">
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
                  className={`relative h-2.5 overflow-hidden rounded-full bg-paper-inset outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ngoc ${
                    speechEnabled ? "pointer-events-none cursor-default opacity-95" : "cursor-pointer"
                  }`}
                  onPointerDown={onSeekTrackPointerDown}
                  onPointerMove={onSeekTrackPointerMove}
                  onPointerUp={onSeekTrackPointerUp}
                  onPointerCancel={onSeekTrackPointerUp}
                  onKeyDown={onSeekTrackKeyDown}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-ngoc transition-[width] duration-150 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-ink-faint">
                  <span>{formatTime(uiCurrentTime)}</span>
                  <span>{formatTime(uiDuration)}</span>
                </div>
              </>
            )}
            {speechEnabled ? (
              <p
                className={`text-ink-faint ${readCompact ? "mt-0.5 text-[8px] leading-tight" : "mt-1 text-[10px]"}`}
              >
                Thanh tiến độ là ước lượng; không tua được khi đọc trình duyệt.
              </p>
            ) : null}
          </div>

          {autoplayBlockedMessage ? (
            <p
              role="status"
              className={`mb-1 text-center leading-snug text-chusa ${readCompact ? "text-[10px]" : "text-xs"}`}
            >
              {autoplayBlockedMessage}
            </p>
          ) : null}

          <div
            className={`flex min-w-0 items-center ${readCompact ? "justify-between gap-2" : "flex-wrap gap-2 sm:gap-3"}`}
          >
            <button
              type="button"
              onClick={togglePlay}
              className={`flex shrink-0 items-center justify-center rounded-full bg-ngoc text-[#f6ede0] shadow-ngoc/30 transition hover:scale-[1.02] hover:bg-ngoc-deep active:scale-[0.98] ${
                readCompact
                  ? "h-8 w-8 shadow-md ring-2 ring-paper/60"
                  : "h-14 w-14 shadow-lg ring-4 ring-paper/70"
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
                  className={`flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft shadow-sm transition hover:border-ngoc/40 hover:bg-ngoc/10 hover:text-ngoc ${
                    sleepTimer > 0 || playbackRate !== 1
                      ? "ring-2 ring-ngoc/35"
                      : ""
                  }`}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-raised px-3 py-2 shadow-sm">
                <div className="flex min-w-0 flex-[1_1_8rem] items-center gap-2 sm:flex-[1_1_12rem]">
                  <span className="shrink-0 text-ink-faint" aria-hidden>
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
                    className="h-1.5 min-w-0 flex-1 cursor-pointer accent-ngoc"
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
                      className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-xs font-bold tabular-nums text-ink-soft shadow-sm transition hover:border-ngoc/40 hover:bg-ngoc/10"
                    >
                      {playbackRate}x
                    </button>
                    {showSpeedMenu ? (
                      <div
                        className="absolute bottom-full right-0 z-10 mb-2 min-w-[5.5rem] overflow-hidden rounded-xl border border-line bg-paper-raised py-1 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {SPEED_OPTIONS.map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => handleSpeedChange(speed)}
                            className={`block w-full px-3 py-2 text-left text-xs font-medium tabular-nums hover:bg-paper-inset ${
                              playbackRate === speed
                                ? "bg-ngoc/10 text-ngoc"
                                : "text-ink-soft"
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
                          ? "border-ngoc/40 bg-ngoc/10 text-ngoc"
                          : "border-line bg-paper-raised text-ink-soft hover:border-ngoc/40"
                      }`}
                      title="Hẹn giờ tắt"
                    >
                      {sleepTimeLeft !== null && sleepTimeLeft > 0 ? formatSleepTime(sleepTimeLeft) : "⏰"}
                    </button>
                    {showSleepMenu ? (
                      <div
                        className="absolute bottom-full right-0 z-10 mb-2 w-44 overflow-hidden rounded-xl border border-line bg-paper-raised py-1 shadow-xl"
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
                            className={`block w-full px-3 py-2 text-left text-xs font-medium hover:bg-paper-inset ${
                              sleepTimer === opt.minutes
                                ? "text-ngoc"
                                : "text-ink-soft"
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
                      className="max-w-[9rem] shrink-0 cursor-pointer truncate rounded-md border border-line bg-paper-raised py-1 pl-1.5 pr-7 text-xs font-medium text-ink shadow-sm"
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
          {title && <h3 className="mb-3 text-sm font-medium text-ink">{title}</h3>}

          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-ink-faint">{formatTime(uiCurrentTime)}</span>
            <div
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={Math.max(0, Math.floor(seekMax))}
              aria-valuenow={Math.min(Math.floor(uiCurrentTime), Math.floor(seekMax))}
              aria-label="Tiến độ phát"
              className={`relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-paper-inset outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ngoc ${
                speechEnabled ? "pointer-events-none cursor-default opacity-90" : "cursor-pointer"
              }`}
              onPointerDown={onSeekTrackPointerDown}
              onPointerMove={onSeekTrackPointerMove}
              onPointerUp={onSeekTrackPointerUp}
              onPointerCancel={onSeekTrackPointerUp}
              onKeyDown={onSeekTrackKeyDown}
            >
              <div
                className="pointer-events-none absolute inset-y-0 left-0 bg-ngoc"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-ink-faint">{formatTime(uiDuration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-ngoc text-[#f6ede0] hover:bg-ngoc-deep"
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
                <svg className="h-4 w-4 text-ink-faint" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-20 cursor-pointer accent-ngoc"
                  aria-label="Âm lượng"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative" ref={speedMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="rounded px-2 py-1 text-xs font-medium text-ink-soft hover:bg-paper-inset"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-1 rounded border border-line bg-paper-raised py-1 shadow-lg">
                    {SPEED_OPTIONS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => handleSpeedChange(speed)}
                        className={`block w-full px-3 py-1 text-left text-xs hover:bg-paper-inset ${
                          playbackRate === speed
                            ? "font-bold text-ink"
                            : "text-ink-soft"
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
                  onClick={() => (sleepTimer > 0 ? setSleepTimer(0) : setSleepTimer(30))}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    sleepTimer > 0
                      ? "bg-ngoc/10 text-ngoc"
                      : "text-ink-soft hover:bg-paper-inset"
                  }`}
                >
                  {sleepTimeLeft !== null ? formatSleepTime(sleepTimeLeft) : "⏰"}
                </button>
              </div>

              {chapters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowChapterList(!showChapterList)}
                  className="rounded px-2 py-1 text-xs font-medium text-ink-soft hover:bg-paper-inset"
                >
                  📖 Chương ({chapters.length})
                </button>
              )}
            </div>
          </div>

          {showChapterList && chapters.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto rounded border border-line">
              {chapters.map((chapter) => {
                const can = Boolean(chapter.audio_single_url?.trim()) || Boolean(chapter.speech_text?.trim());
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => handleChapterSelect(chapter)}
                    disabled={!can}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      currentChapterId === chapter.id
                        ? "bg-paper-inset"
                        : "hover:bg-paper-inset"
                    } ${!can ? "opacity-50" : ""}`}
                  >
                    <span className="truncate">{chapter.title}</span>
                    {chapter.audio_single_url?.trim() ? (
                      <span className="text-xs text-ngoc">✓</span>
                    ) : can ? (
                      <span className="text-xs text-chusa">Trình duyệt</span>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
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
              className="z-[100] w-[min(17.5rem,calc(100vw-1.5rem))] space-y-3 overflow-y-auto rounded-xl border border-line bg-paper-raised p-3 shadow-2xl ring-1 ring-black/5"
              style={{
                position: "fixed",
                right: readMenuPlacement.right,
                bottom: readMenuPlacement.bottom,
                maxHeight: readMenuPlacement.maxHeight,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                  Âm lượng
                </p>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-ink-faint" aria-hidden>
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
                    className="h-1 min-w-0 flex-1 cursor-pointer accent-ngoc"
                    aria-label="Âm lượng"
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
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
                          ? "border-ngoc bg-ngoc text-[#f6ede0] shadow-sm"
                          : "border-line bg-paper-inset text-ink-soft hover:border-ngoc/40"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
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
                          ? "border-ngoc bg-ngoc/10 text-ngoc"
                          : "border-line bg-paper-raised text-ink-soft hover:border-ngoc/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {sleepTimeLeft !== null && sleepTimeLeft > 0 ? (
                  <p className="mt-1.5 font-mono text-[10px] text-ngoc">
                    Còn {formatSleepTime(sleepTimeLeft)}
                  </p>
                ) : null}
              </div>
              {speechEnabled && viSpeechOptions.length > 0 ? (
                <div>
                  <label
                    htmlFor="read-audio-voice"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    Giọng đọc
                  </label>
                  <select
                    id="read-audio-voice"
                    aria-label="Giọng đọc trình duyệt"
                    title="Giọng đọc trình duyệt"
                    className="w-full max-w-full cursor-pointer truncate rounded-lg border border-line bg-paper-raised py-1.5 pl-2 pr-8 text-xs font-medium text-ink shadow-sm"
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

function AudiowebChapterNavPrevIcon() {
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

function AudiowebChapterNavNextIcon() {
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
