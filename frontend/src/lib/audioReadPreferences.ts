/**
 * Cài đặt đọc (volume, tốc độ) + tiến độ theo chương — một key localStorage.
 * Hẹn giờ tắt (`sleepPresetMinutes` / `sleepDeadlineAt`) là toàn app: đếm wall-clock, không reset khi đổi chương.
 */

const STORAGE_KEY = "story-audio-read-prefs:v1";

/** Cùng tên với `STORY_AUDIOREAD_SLEEP_ENDED` — gọi từ lib, không import context (tránh vòng). */
export const AUDIOREAD_SLEEP_ENDED_EVENT_NAME = "story-audioread-sleep-ended";

/** Bắn sau khi prefs hẹn giờ đổi (vd. hết giờ) — `AudioReadSleepProvider` lắng nghe để `bump` UI về "Tắt". */
export const AUDIOREAD_SLEEP_UI_BUMP_EVENT_NAME = "story-audioread-sleep-ui-bump";

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;
const SLEEP_PRESETS = new Set([0, 3, 15, 30, 45, 60, 90]);

const MAX_TTS_SENTENCE_INDEX = 2_000_000;
const MAX_AUDIO_SEC = 36 * 3600;

export type AudioReadPrefs = {
  volume: number;
  playbackRate: number;
  sleepPresetMinutes: number;
  sleepDeadlineAt: number | null;
  /** AudioWeb: chỉ số câu, key `story-audioweb:{storySlug}:{chapterKey}` (slug URL; legacy id vẫn migrate một lần). */
  chapterTtsSentence: Record<string, number>;
  /** File audio (AudioPlayer): giây, key ví dụ `story-audiofile:{storyId}:{chapterId}` */
  chapterAudioSec: Record<string, number>;
};

export type SaveAudioReadPrefsPatch = Partial<AudioReadPrefs> & {
  removeChapterTtsSentenceKeys?: string[];
  removeChapterAudioSecKeys?: string[];
};

export function defaultAudioReadPrefs(): AudioReadPrefs {
  return {
    volume: 1,
    playbackRate: 1,
    sleepPresetMinutes: 0,
    sleepDeadlineAt: null,
    chapterTtsSentence: {},
    chapterAudioSec: {},
  };
}

function sanitizeChapterNumberMap(
  raw: unknown,
  opts: { max: number; integerOnly: boolean },
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || k.length > 160) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const n = opts.integerOnly ? Math.floor(v) : v;
    if (n < 0 || n > opts.max) continue;
    out[k] = n;
  }
  return out;
}

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

export function clampPlaybackRate(r: number): number {
  if (!Number.isFinite(r)) return 1;
  let best: number = PLAYBACK_RATES[0];
  let bestD = Math.abs(r - best);
  for (const o of PLAYBACK_RATES) {
    const d = Math.abs(r - o);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/** Preset hẹn giờ tắt (phút): 0 = tắt, hoặc một trong các mốc cố định (3 = thử nhanh). */
export function clampSleepPresetMinutes(m: number): number {
  if (!Number.isFinite(m) || m <= 0) return 0;
  if (SLEEP_PRESETS.has(m)) return m;
  return 0;
}

export function loadAudioReadPrefs(): AudioReadPrefs {
  const d = defaultAudioReadPrefs();
  if (typeof window === "undefined") return d;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return d;
    const o = JSON.parse(raw) as Partial<AudioReadPrefs>;
    const volume = clampVolume(typeof o.volume === "number" ? o.volume : d.volume);
    const playbackRate = clampPlaybackRate(typeof o.playbackRate === "number" ? o.playbackRate : d.playbackRate);
    let sleepPresetMinutes = clampSleepPresetMinutes(
      typeof o.sleepPresetMinutes === "number" ? o.sleepPresetMinutes : d.sleepPresetMinutes,
    );
    let sleepDeadlineAt =
      typeof o.sleepDeadlineAt === "number" && Number.isFinite(o.sleepDeadlineAt) ? o.sleepDeadlineAt : null;

    if (sleepPresetMinutes <= 0) {
      sleepDeadlineAt = null;
    } else if (sleepDeadlineAt == null) {
      // Có preset nhưng không có deadline — không đếm được; `tryConsumeExpiredAudioReadSleep` không xử lý được.
      sleepPresetMinutes = 0;
      sleepDeadlineAt = null;
    }
    // Giữ preset + deadline đã qua trong RAM cho đến khi `tryConsumeExpiredAudioReadSleep` lưu storage sạch
    // (trước đây xóa deadline mà giữ preset → không bao giờ `expired`).
    const chapterTtsSentence = sanitizeChapterNumberMap(o.chapterTtsSentence, {
      max: MAX_TTS_SENTENCE_INDEX,
      integerOnly: true,
    });
    const chapterAudioSec = sanitizeChapterNumberMap(o.chapterAudioSec, {
      max: MAX_AUDIO_SEC,
      integerOnly: false,
    });
    return { volume, playbackRate, sleepPresetMinutes, sleepDeadlineAt, chapterTtsSentence, chapterAudioSec };
  } catch {
    return d;
  }
}

export function saveAudioReadPrefs(patch: SaveAudioReadPrefsPatch): void {
  if (typeof window === "undefined") return;
  const cur = loadAudioReadPrefs();

  let chapterTtsSentence = cur.chapterTtsSentence;
  if (patch.chapterTtsSentence && Object.keys(patch.chapterTtsSentence).length > 0) {
    chapterTtsSentence = { ...cur.chapterTtsSentence, ...patch.chapterTtsSentence };
  }
  if (patch.removeChapterTtsSentenceKeys?.length) {
    chapterTtsSentence = { ...chapterTtsSentence };
    for (const k of patch.removeChapterTtsSentenceKeys) {
      delete chapterTtsSentence[k];
    }
  }

  let chapterAudioSec = cur.chapterAudioSec;
  if (patch.chapterAudioSec && Object.keys(patch.chapterAudioSec).length > 0) {
    chapterAudioSec = { ...cur.chapterAudioSec, ...patch.chapterAudioSec };
  }
  if (patch.removeChapterAudioSecKeys?.length) {
    chapterAudioSec = { ...chapterAudioSec };
    for (const k of patch.removeChapterAudioSecKeys) {
      delete chapterAudioSec[k];
    }
  }

  const next: AudioReadPrefs = {
    volume: clampVolume(patch.volume ?? cur.volume),
    playbackRate: clampPlaybackRate(patch.playbackRate ?? cur.playbackRate),
    sleepPresetMinutes: clampSleepPresetMinutes(
      patch.sleepPresetMinutes !== undefined ? patch.sleepPresetMinutes : cur.sleepPresetMinutes,
    ),
    sleepDeadlineAt: patch.sleepDeadlineAt !== undefined ? patch.sleepDeadlineAt : cur.sleepDeadlineAt,
    chapterTtsSentence,
    chapterAudioSec,
  };
  if (next.sleepPresetMinutes <= 0) {
    next.sleepDeadlineAt = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Deadline hẹn giờ đã qua: xóa prefs, cancel TTS, bắn event để AudioWeb/AudioPlayer dừng phát.
 * Idempotent sau khi đã xóa. Gọi định kỳ hoặc giữa các câu TTS.
 */
export function tryConsumeExpiredAudioReadSleep(): boolean {
  if (typeof window === "undefined") return false;
  const p = loadAudioReadPrefs();
  if (p.sleepPresetMinutes <= 0) return false;
  if (p.sleepDeadlineAt == null || p.sleepDeadlineAt > Date.now()) return false;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  saveAudioReadPrefs({ sleepPresetMinutes: 0, sleepDeadlineAt: null });
  window.dispatchEvent(new Event(AUDIOREAD_SLEEP_ENDED_EVENT_NAME));
  window.dispatchEvent(new Event(AUDIOREAD_SLEEP_UI_BUMP_EVENT_NAME));
  return true;
}

/** Khởi tạo state hẹn giờ từ prefs (giữ đếm ngược nếu deadline còn trong tương lai). */
export function initialSleepFromPrefs(p: AudioReadPrefs): { preset: number; left: number | null } {
  if (p.sleepPresetMinutes <= 0) return { preset: 0, left: null };
  if (p.sleepDeadlineAt != null && p.sleepDeadlineAt > Date.now()) {
    const left = Math.max(0, Math.ceil((p.sleepDeadlineAt - Date.now()) / 1000));
    if (left <= 0) return { preset: 0, left: null };
    return { preset: p.sleepPresetMinutes, left };
  }
  return { preset: 0, left: null };
}
